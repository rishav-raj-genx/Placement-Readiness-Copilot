type ServiceName = 'profile review' | 'interview' | 'automation';

function firstConfigured(...values: Array<string | undefined>): string | undefined {
  return values.find((value): value is string => Boolean(value?.trim()));
}

function normalizeServiceBase(rawValue: string | undefined, service: ServiceName): string {
  if (!rawValue?.trim()) throw new Error(`${service} service URL is not configured.`);
  const url = new URL(rawValue.trim());
  if (url.pathname.replace(/\/$/, '') === '/health') url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function getProfileReviewBaseUrl(): string {
  return normalizeServiceBase(
    firstConfigured(process.env.PROFILE_REVIEW_API_URL, process.env.PROFILE_ENGINE_URL),
    'profile review',
  );
}

export function getInterviewBaseUrl(): string {
  return normalizeServiceBase(process.env.INTERVIEW_SERVICE_URL, 'interview');
}

export function getOptionalInterviewBaseUrl(): string {
  const configured = firstConfigured(process.env.INTERVIEW_SERVICE_URL, process.env.NEXT_PUBLIC_INTERVIEW_URL);
  if (!configured) return 'http://127.0.0.1:8002';
  try {
    return normalizeServiceBase(configured, 'interview');
  } catch {
    return 'http://127.0.0.1:8002';
  }
}

export function getAutomationBaseUrl(): string {
  return normalizeServiceBase(
    firstConfigured(
      process.env.AUTOMATION_API_URL,
      process.env.AUTOMATION_SERVICE_URL,
    ),
    'automation',
  );
}

export function getOptionalAutomationBaseUrl(): string | null {
  const rawValue = firstConfigured(
    process.env.AUTOMATION_API_URL,
    process.env.AUTOMATION_SERVICE_URL,
  );
  return rawValue ? normalizeServiceBase(rawValue, 'automation') : null;
}

export interface ServiceRequestOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

export function getInternalServiceToken(): string {
  const secret = (
    process.env.INTERNAL_SERVICE_SECRET ||
    process.env.INTERNAL_SERVICE_KEY ||
    process.env.PROFILE_REVIEW_SERVICE_TOKEN ||
    process.env.AUTOMATION_SERVICE_TOKEN ||
    ''
  ).trim();

  return secret;
}

export async function serviceRequest(url: string, options: ServiceRequestOptions = {}): Promise<unknown> {
  const maxRetries = options.maxRetries ?? 3;
  const initialBackoffMs = options.initialBackoffMs ?? 500;
  const maxBackoffMs = options.maxBackoffMs ?? 10_000;
  let attempt = 0;

  while (true) {
    attempt++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);
    const headers = new Headers(options.headers);
    if (!headers.has('Authorization')) {
      const serviceToken = getInternalServiceToken();
      if (serviceToken) {
        headers.set('Authorization', `Bearer ${serviceToken}`);
      } else {
        clearTimeout(timeout);
        const errorMsg =
          'Server Misconfiguration: INTERNAL_SERVICE_SECRET is missing or evaluated to undefined on the Next.js server.';
        console.error(`[backend-services] Configuration Error: ${errorMsg}`);
        throw new Error(errorMsg);
      }
    } else {
      const currentAuth = headers.get('Authorization')?.trim() ?? '';
      headers.set('Authorization', currentAuth);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);

      const payload: unknown = await response.json().catch(() => null);

      if (response.ok) {
        return payload;
      }

      const detail =
        typeof payload === 'object' && payload !== null && 'detail' in payload
          ? String((payload as Record<string, unknown>).detail)
          : `${response.status} ${response.statusText}`;

      if (detail.includes('Invalid service token')) {
        let origin = url;
        try { origin = new URL(url).origin; } catch {}
        throw new Error(
          `Service request rejected: Upstream microservice (${origin}) reported "Invalid service token". Verify that INTERNAL_SERVICE_SECRET or INTERNAL_SERVICE_KEY in your microservice deployment matches Vercel.`
        );
      }

      if (detail.includes('Service authentication secret is not configured')) {
        let origin = url;
        try { origin = new URL(url).origin; } catch {}
        throw new Error(
          `Service authentication secret is not configured on the microservice (${origin}). Please set INTERNAL_SERVICE_KEY or INTERNAL_SERVICE_SECRET in your backend deployment environment variables (e.g., on Render).`
        );
      }

      // 4xx errors (excluding 429 Too Many Requests) fail immediately without retrying
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`Service request failed: ${detail}`);
      }

      const isTimeout =
        response.status === 504 ||
        detail.toLowerCase().includes('timed out') ||
        detail.toLowerCase().includes('timeout');

      if (attempt > maxRetries) {
        if (isTimeout) {
          throw new Error('Service request timed out.');
        }
        throw new Error(`Service request failed after ${attempt} attempts: ${detail}`);
      }

      // Extract Retry-After header or calculate exponential backoff with random jitter
      let backoffMs: number;
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter) {
        const parsedSeconds = parseFloat(retryAfter);
        if (!Number.isNaN(parsedSeconds) && parsedSeconds > 0) {
          backoffMs = parsedSeconds * 1000;
        } else {
          const dateMs = new Date(retryAfter).getTime();
          backoffMs = !Number.isNaN(dateMs) && dateMs > Date.now() ? dateMs - Date.now() : initialBackoffMs;
        }
      } else {
        const exponential = initialBackoffMs * Math.pow(2, attempt - 1);
        const jitter = Math.random() * (exponential * 0.3);
        backoffMs = Math.min(maxBackoffMs, exponential + jitter);
      }

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    } catch (error) {
      clearTimeout(timeout);

      // Re-throw immediately if this is an explicit non-retriable failure
      if (
        error instanceof Error &&
        (error.message.startsWith('Service request failed:') ||
          error.message.startsWith('Service request rejected:') ||
          error.message.startsWith('Service authentication secret is not configured') ||
          error.message.startsWith('Server Misconfiguration:'))
      ) {
        throw error;
      }

      if (attempt > maxRetries) {
        if (
          error instanceof Error &&
          (error.name === 'AbortError' ||
            error.message.toLowerCase().includes('timed out') ||
            error.message.toLowerCase().includes('timeout'))
        ) {
          throw new Error('Service request timed out.');
        }
        throw error;
      }

      const exponential = initialBackoffMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * (exponential * 0.3);
      const backoffMs = Math.min(maxBackoffMs, exponential + jitter);

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}
