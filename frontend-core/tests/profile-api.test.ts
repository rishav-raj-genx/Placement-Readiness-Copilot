import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET, PATCH, POST } from '@/app/api/profile/route';

const mockGetUser = vi.fn();
const mockAdminUpdate = vi.fn();
const mockAdminSelect = vi.fn();

vi.mock('@/lib/supabase-session-server', () => ({
  createServerSessionClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

vi.mock('@/lib/supabase-server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          update: (payload: Record<string, unknown>) => ({
            eq: (_col: string, _val: string) => mockAdminUpdate(payload),
          }),
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              maybeSingle: () => mockAdminSelect(),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

describe('Profile API Route (/api/profile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = new Request('http://localhost:3000/api/profile', {
      method: 'GET',
    });
    const res = await GET();
    expect(res.status).toBe(401);

    const patchReq = new Request('http://localhost:3000/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Test User' }),
    });
    const patchRes = await PATCH(patchReq);
    expect(patchRes.status).toBe(401);
  });

  it('safely strips undefined and unrecognized fields during PATCH update', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-123' } } });
    mockAdminUpdate.mockResolvedValue({ error: null });
    mockAdminSelect.mockResolvedValue({
      data: {
        id: 'usr-123',
        display_name: 'Jane Doe',
        target_role: 'Full Stack Engineer',
        github_username: 'janedoe',
        leetcode_url: 'https://leetcode.com/u/janedoe',
        linkedin_text: 'Engineering lead',
      },
    });

    const dirtyPayload = {
      displayName: 'Jane Doe',
      targetRole: 'Full Stack Engineer',
      githubUsername: 'janedoe',
      leetcodeUrl: 'https://leetcode.com/u/janedoe',
      linkedinText: 'Engineering lead',
      unrecognizedField1: 'MALICIOUS_INJECTION',
      unknownStateObj: { foo: 'bar' },
      undefinedParam: undefined,
    };

    const req = new Request('http://localhost:3000/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dirtyPayload),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify sanitizeProfilePayload stripped out unrecognized fields
    const passedUpdate = mockAdminUpdate.mock.calls[0][0];
    expect(passedUpdate.display_name).toBe('Jane Doe');
    expect(passedUpdate.target_role).toBe('Full Stack Engineer');
    expect(passedUpdate.github_username).toBe('janedoe');
    expect(passedUpdate.leetcode_url).toBe('https://leetcode.com/u/janedoe');
    expect(passedUpdate.linkedin_text).toBe('Engineering lead');
    expect(passedUpdate.unrecognizedField1).toBeUndefined();
    expect(passedUpdate.unknownStateObj).toBeUndefined();
    expect(passedUpdate.undefinedParam).toBeUndefined();
  });

  it('retries without leetcode_url if database schema column is missing (PGRST204)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-123' } } });

    // First call fails with missing leetcode_url column error
    mockAdminUpdate
      .mockResolvedValueOnce({
        error: {
          code: 'PGRST204',
          message: "Could not find the 'leetcode_url' column of 'profiles' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null }); // Retry succeeds

    mockAdminSelect.mockResolvedValue({
      data: {
        id: 'usr-123',
        display_name: 'Jane Doe',
        target_role: 'SDE',
      },
    });

    const req = new Request('http://localhost:3000/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Jane Doe',
        targetRole: 'SDE',
        leetcodeUrl: 'https://leetcode.com/u/janedoe',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Initial update had leetcode_url
    expect(mockAdminUpdate.mock.calls[0][0].leetcode_url).toBe('https://leetcode.com/u/janedoe');
    // Fallback retry stripped leetcode_url
    expect(mockAdminUpdate.mock.calls[1][0].leetcode_url).toBeUndefined();
    expect(mockAdminUpdate.mock.calls[1][0].display_name).toBe('Jane Doe');
  });
});
