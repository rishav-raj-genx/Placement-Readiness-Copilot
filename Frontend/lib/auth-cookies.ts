import type { UserRole } from '@/types';

/**
 * lib/auth-cookies.ts
 *
 * Client-side cookie management to synchronize Supabase / Demo auth state
 * with Next.js Edge Middleware.
 *
 * Edge Middleware only has access to HTTP request cookies, not localStorage.
 * This module ensures cookies are written on login and cleared on logout.
 */

function getProjectRef(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
}

/**
 * Set session cookies for an authenticated user (Supabase session)
 */
export function setAuthCookies(
  session: { access_token: string; user: { id: string } },
  role: UserRole
): void {
  if (typeof document === 'undefined') return;

  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const tokenData = encodeURIComponent(
    JSON.stringify({
      access_token: session.access_token,
      user_id: session.user.id,
    })
  );

  document.cookie = `sb-auth-token=${tokenData}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `sb-user-role=${role}; path=/; max-age=${maxAge}; SameSite=Lax`;

  const projectRef = getProjectRef();
  if (projectRef) {
    document.cookie = `sb-${projectRef}-auth-token=${tokenData}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }
}

/**
 * Set session cookies for demo mode
 */
export function setDemoCookies(role: UserRole): void {
  if (typeof document === 'undefined') return;

  const maxAge = 60 * 60 * 24 * 7; // 7 days
  document.cookie = `demo-session=${role}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `sb-user-role=${role}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Clear all auth and role cookies upon sign out
 */
export function clearAllAuthCookies(): void {
  if (typeof document === 'undefined') return;

  const expired = 'path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  document.cookie = `demo-session=; ${expired}`;
  document.cookie = `sb-auth-token=; ${expired}`;
  document.cookie = `sb-user-role=; ${expired}`;

  const projectRef = getProjectRef();
  if (projectRef) {
    document.cookie = `sb-${projectRef}-auth-token=; ${expired}`;
  }
}
