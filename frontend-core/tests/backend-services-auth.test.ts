import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serviceRequest } from '@/lib/backend-services';

describe('serviceRequest authentication and secret validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('throws an actionable configuration error when no internal service secret is configured', async () => {
    vi.stubEnv('INTERNAL_SERVICE_KEY', '');
    vi.stubEnv('INTERNAL_SERVICE_SECRET', '');
    vi.stubEnv('PROFILE_REVIEW_SERVICE_TOKEN', '');
    vi.stubEnv('AUTOMATION_SERVICE_TOKEN', '');

    await expect(
      serviceRequest('http://127.0.0.1:8001/api/test', {
        method: 'GET',
      })
    ).rejects.toThrowError(
      'Server Misconfiguration: INTERNAL_SERVICE_SECRET is missing or evaluated to undefined on the Next.js server.'
    );
  });

  it('attaches trimmed Authorization header when INTERNAL_SERVICE_SECRET has whitespace', async () => {
    vi.stubEnv('INTERNAL_SERVICE_KEY', '');
    vi.stubEnv('INTERNAL_SERVICE_SECRET', '  test-secret-token-xyz \n');

    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe('Bearer test-secret-token-xyz');
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await serviceRequest('http://127.0.0.1:8001/api/test', {
      method: 'GET',
    });
    expect(res).toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('provides a descriptive error when microservice reports Invalid service token', async () => {
    vi.stubEnv('INTERNAL_SERVICE_SECRET', 'valid-client-token');

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          detail: 'Invalid service token.',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      serviceRequest('https://profile-review-api.onrender.com/analyze-profile', {
        method: 'POST',
      })
    ).rejects.toThrowError(
      /Service request rejected: Upstream microservice \(https:\/\/profile-review-api\.onrender\.com\) reported "Invalid service token"\. Verify that INTERNAL_SERVICE_SECRET or INTERNAL_SERVICE_KEY in your microservice deployment matches Vercel\./
    );
  });

  it('provides a descriptive error when microservice reports missing server secret', async () => {
    vi.stubEnv('INTERNAL_SERVICE_KEY', 'valid-client-token');

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          detail: 'Service authentication secret is not configured on the server.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      serviceRequest('https://profile-review-api.onrender.com/analyze-profile', {
        method: 'POST',
      })
    ).rejects.toThrowError(
      /Service authentication secret is not configured on the microservice \(https:\/\/profile-review-api\.onrender\.com\)\. Please set INTERNAL_SERVICE_KEY or INTERNAL_SERVICE_SECRET/
    );
  });
});
