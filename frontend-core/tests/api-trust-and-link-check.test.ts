import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase-session-server', () => ({
  createServerSessionClient: vi.fn(),
}));

vi.mock('@/lib/supabase-server', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/backend-services', () => ({
  getAutomationBaseUrl: vi.fn(() => 'http://127.0.0.1:8001'),
  getProfileReviewBaseUrl: vi.fn(() => 'http://127.0.0.1:8000'),
  serviceRequest: vi.fn(),
}));

describe('Phase 2 & Phase 3: API Trust & Live-Link Claim Verification', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { createServerSessionClient } = await import('@/lib/supabase-session-server');
    vi.mocked(createServerSessionClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'student-999', email: 'test@student.edu' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'student-999',
                projects: [],
              },
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createServerSessionClient>);
  });

  it('extracts specific project claims (React, Tailwind, auth) and passes to link-check', async () => {
    const { serviceRequest } = await import('@/lib/backend-services');
    vi.mocked(serviceRequest).mockResolvedValueOnce({
      url: 'https://demo.app',
      is_live: true,
      passed: false,
      quality_score: 45.0,
      content_evaluation: {
        claims_matched: false,
        matched_keywords: [],
        missing_keywords: ['react', 'tailwind', 'auth'],
      },
      recommendations: ['Claims mismatch: live site missing claimed stack.'],
    });

    const { POST: handleProjectCheck } = await import('@/app/api/projects/check/route');

    const req = new NextRequest('http://localhost:3000/api/projects/check', {
      method: 'POST',
      body: JSON.stringify({
        liveUrl: 'https://demo.app',
        projectName: 'Task Runner',
        description: 'React, Tailwind, auth dashboard with real-time queues',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handleProjectCheck(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      passed: boolean;
      claimsMatched: boolean;
      qualityScore: number;
    };

    expect(body.passed).toBe(false);
    expect(body.claimsMatched).toBe(false);
    expect(body.qualityScore).toBe(45.0);

    // Verify backend service was passed specific project claims, NOT generic profile skills
    expect(serviceRequest).toHaveBeenCalled();
    const serviceCallArgs = vi.mocked(serviceRequest).mock.calls[0];
    const sentBody = JSON.parse(serviceCallArgs[1]?.body as string) as {
      claimed_keywords: string[];
      student_id: string;
      url: string;
    };
    expect(sentBody.student_id).toBe('student-999');
    expect(sentBody.url).toBe('https://demo.app');
    expect(sentBody.claimed_keywords.some((k) => k.toLowerCase().includes('react'))).toBe(true);
    expect(sentBody.claimed_keywords.some((k) => k.toLowerCase().includes('tailwind'))).toBe(true);
    expect(sentBody.claimed_keywords.some((k) => k.toLowerCase().includes('auth'))).toBe(true);
  });

  it('rejects missing or empty liveUrl with 400', async () => {
    const { POST: handleProjectCheck } = await import('@/app/api/projects/check/route');

    const req = new NextRequest('http://localhost:3000/api/projects/check', {
      method: 'POST',
      body: JSON.stringify({
        projectName: 'Task Runner',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handleProjectCheck(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('valid live URL is required');
  });

  it('returns HTTP 502 without fake passes when AI analyzer service fails or times out', async () => {
    const { createAdminClient } = await import('@/lib/supabase-server');
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'student-999',
                email: 'student@example.com',
                display_name: 'Student One',
                role: 'student',
                resume_pdf_path: 'student-999/resume.pdf',
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
      storage: {
        from: vi.fn().mockReturnValue({
          download: vi.fn().mockResolvedValue({
            data: new Blob(['%PDF-1.4 test resume']),
            error: null,
          }),
        }),
      },
    } as unknown as ReturnType<typeof createAdminClient>);

    const { serviceRequest } = await import('@/lib/backend-services');
    vi.mocked(serviceRequest).mockRejectedValueOnce(new Error('AI scoring service timeout after 60s'));

    const { POST: handleAnalyze } = await import('@/app/api/profile-review/analyze/route');

    const req = new Request('http://localhost:3000/api/profile-review/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'student-999' }),
    });

    const res = await handleAnalyze(req);
    // Explicit HTTP 502 or 504 on failure, NO fake 80/75/70 pass defaults!
    expect([502, 504]).toContain(res.status);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toMatch(/AI_ANALYZER_/);
    expect(body.error).toContain('AI analyzer failed or timed out');
  });
});
