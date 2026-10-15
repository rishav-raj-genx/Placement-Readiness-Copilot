/**
 * Synchronises the browser session with middleware. Middleware verifies the
 * token and loads the role from Supabase, so neither is trusted from a cookie.
 */
export function setAuthCookies(
  session: { access_token: string; user: { id: string } }
): void {
  if (typeof document === 'undefined') return;

  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const tokenData = encodeURIComponent(
    JSON.stringify({
      access_token: session.access_token,
      user_id: session.user.id,
    })
  );

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `sb-auth-token=${tokenData}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

/**
 * Clear all auth and role cookies upon sign out
 */
export function clearAllAuthCookies(): void {
  if (typeof document === 'undefined') return;

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const expired = `path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secure}`;
  document.cookie = `sb-auth-token=; ${expired}`;
}
