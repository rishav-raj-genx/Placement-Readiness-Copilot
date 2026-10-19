type ServiceName = 'profile review' | 'interview' | 'automation';

function normalizeServiceBase(rawValue: string | undefined, service: ServiceName): string {
  if (!rawValue?.trim()) throw new Error(`${service} service URL is not configured.`);
  const url = new URL(rawValue.trim());
  if (url.pathname.replace(/\/$/, '') === '/health') url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function getProfileReviewBaseUrl(): string {
  return normalizeServiceBase(process.env.PROFILE_REVIEW_API_URL, 'profile review');
}

export function getInterviewBaseUrl(): string {
  return normalizeServiceBase(process.env.INTERVIEW_SERVICE_URL, 'interview');
}

export function getAutomationBaseUrl(): string {
  return normalizeServiceBase(process.env.AUTOMATION_API_URL, 'automation');
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
