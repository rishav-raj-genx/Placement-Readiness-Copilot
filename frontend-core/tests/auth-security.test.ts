import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/profile-review/analyze/route';

vi.mock('@/lib/supabase-session-server', () => ({
  createServerSessionClient: vi.fn(),
}));

vi.mock('@/lib/supabase-server', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'user-123',
              email: 'student@example.com',
              display_name: 'Student One',
              role: 'student',
              onboarding_completed_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  })),
}));

describe('analyze API route authentication & spoofing defense', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests without session or valid internal key', async () => {
    const { createServerSessionClient } = await import('@/lib/supabase-session-server');
    vi.mocked(createServerSessionClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as ReturnType<typeof createServerSessionClient>);

    const req = new Request('http://localhost:3000/api/profile-review/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-123' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('forbids arbitrary userId spoofing when authenticated user does not match body userId', async () => {
    const { createServerSessionClient } = await import('@/lib/supabase-session-server');
    vi.mocked(createServerSessionClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'legit-user-456' } },
          error: null,
        }),
      },
    } as unknown as ReturnType<typeof createServerSessionClient>);

    const req = new Request('http://localhost:3000/api/profile-review/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'victim-user-789' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('FORBIDDEN');
  });
});
