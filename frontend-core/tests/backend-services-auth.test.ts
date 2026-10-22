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
      /Service authentication secret is not configured on the server\. Please define INTERNAL_SERVICE_KEY or INTERNAL_SERVICE_SECRET/
    );
  });

  it('attaches Authorization header when INTERNAL_SERVICE_SECRET is provided', async () => {
    vi.stubEnv('INTERNAL_SERVICE_KEY', '');
    vi.stubEnv('INTERNAL_SERVICE_SECRET', 'test-secret-token-xyz');

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
