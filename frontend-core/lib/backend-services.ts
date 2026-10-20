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
      process.env.NEXT_PUBLIC_AUTOMATION_URL,
    ),
    'automation',
  );
}

export function getOptionalAutomationBaseUrl(): string | null {
  const rawValue = firstConfigured(
    process.env.AUTOMATION_API_URL,
    process.env.AUTOMATION_SERVICE_URL,
    process.env.NEXT_PUBLIC_AUTOMATION_URL,
  );
  return rawValue ? normalizeServiceBase(rawValue, 'automation') : null;
}

interface ServiceRequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function serviceRequest(url: string, options: ServiceRequestOptions = {}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof payload === 'object' && payload !== null && 'detail' in payload ? String(payload.detail) : `${response.status} ${response.statusText}`;
      throw new Error(`Service request failed: ${detail}`);
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Service request timed out.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
