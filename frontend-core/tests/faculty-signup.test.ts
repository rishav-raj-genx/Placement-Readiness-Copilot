import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockCreateUser = vi.fn();
const mockUpsert = vi.fn();
const mockDeleteUser = vi.fn();

vi.mock('@/lib/supabase-service-server', () => ({
  createSupabaseServiceClient: () => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
      },
    },
    from: () => ({
      upsert: mockUpsert,
    }),
  }),
}));

describe('Faculty & Admin Sign-Up Security Guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_INVITE_CODE = 'MSOT-SECRET-FACULTY-2026';
  });

  it('rejects signup if Faculty Authorization Code is wrong', async () => {
    const { POST } = await import('@/app/api/auth/faculty-signup/route');

    const req = new NextRequest('http://localhost:3000/api/auth/faculty-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Prof. Albus Dumbledore',
        email: 'albus@hogwarts.edu',
        password: 'securePassword123',
        facultyCode: 'WRONG-INVITE-CODE',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Invalid Faculty Authorization Code.');
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('rejects signup if Faculty Authorization Code is missing or empty', async () => {
    const { POST } = await import('@/app/api/auth/faculty-signup/route');

    const req = new NextRequest('http://localhost:3000/api/auth/faculty-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Prof. Minerva McGonagall',
        email: 'minerva@hogwarts.edu',
        password: 'securePassword123',
        facultyCode: '   ',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Faculty Authorization Code is required.');
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('rejects signup with invalid institutional email or short password', async () => {
    const { POST } = await import('@/app/api/auth/faculty-signup/route');

    const reqBadEmail = new NextRequest('http://localhost:3000/api/auth/faculty-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Dr. Severus Snape',
        email: 'not-an-email',
        password: 'password123',
        facultyCode: 'MSOT-SECRET-FACULTY-2026',
      }),
    });

    const resBadEmail = await POST(reqBadEmail);
    expect(resBadEmail.status).toBe(400);
    expect(mockCreateUser).not.toHaveBeenCalled();

    const reqShortPass = new NextRequest('http://localhost:3000/api/auth/faculty-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Dr. Severus Snape',
        email: 'snape@hogwarts.edu',
        password: '123',
        facultyCode: 'MSOT-SECRET-FACULTY-2026',
      }),
    });

    const resShortPass = await POST(reqShortPass);
    expect(resShortPass.status).toBe(400);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('authorizes and creates user with role="admin" when invite code is valid', async () => {
    const { POST } = await import('@/app/api/auth/faculty-signup/route');

    mockCreateUser.mockResolvedValueOnce({
      data: {
        user: { id: 'admin-user-uuid-1234' },
      },
      error: null,
    });

    mockUpsert.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const req = new NextRequest('http://localhost:3000/api/auth/faculty-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Prof. Severus Snape',
        email: 'snape@hogwarts.edu',
        password: 'defenseAgainstTheDarkArts2026',
        facultyCode: 'MSOT-SECRET-FACULTY-2026',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.userId).toBe('admin-user-uuid-1234');
    expect(data.role).toBe('admin');

    // Verify Supabase Admin User was created with admin metadata
    expect(mockCreateUser).toHaveBeenCalledWith({
      email: 'snape@hogwarts.edu',
      password: 'defenseAgainstTheDarkArts2026',
      email_confirm: true,
      user_metadata: {
        display_name: 'Prof. Severus Snape',
        full_name: 'Prof. Severus Snape',
        role: 'admin',
      },
    });

    // Verify profiles table insertion explicitly sets role = 'admin'
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'admin-user-uuid-1234',
        email: 'snape@hogwarts.edu',
        display_name: 'Prof. Severus Snape',
        role: 'admin',
      }),
      { onConflict: 'id' }
    );
  });
});
