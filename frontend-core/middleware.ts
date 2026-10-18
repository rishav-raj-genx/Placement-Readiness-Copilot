import { NextRequest, NextResponse } from 'next/server';

const STUDENT_PATHS = ['/dashboard', '/interview', '/applications', '/jobs', '/resources'];
const ADMIN_PATHS = ['/admin'];

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

type Profile = { role: 'student' | 'admin' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getAccessToken(request: NextRequest): string | null {
  const raw = request.cookies.get('sb-auth-token')?.value;
  if (!raw) return null;
  try {
    const session: unknown = JSON.parse(decodeURIComponent(raw));
    return isRecord(session) && typeof session.access_token === 'string'
      ? session.access_token
      : null;
  } catch {
    return null;
  }
}

interface CacheEntry {
  profile: Profile;
  expiresAt: number;
}

const profileCache = new Map<string, CacheEntry>();

function decodeBase64(str: string): string {
  if (typeof atob === 'function') {
    return atob(str);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64').toString('utf8');
  }
  return '';
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeBase64(base64);
    if (!json) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function getAuthenticatedProfile(token: string): Promise<Profile | null> {
  // 1. Fast local JWT validation (0ms)
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) {
    profileCache.delete(token);
    return null;
  }

  // 2. High-speed in-memory cache lookup for seamless client navigation (0ms)
  const cached = profileCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.profile;
  }

  // 3. Fallback to Supabase on cold cache or initial login
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;

  try {
    const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
    const userResponse = await fetch(`${url}/auth/v1/user`, { headers, cache: 'no-store' });
    if (!userResponse.ok) return null;
    const user: unknown = await userResponse.json();
    if (!isRecord(user) || typeof user.id !== 'string') return null;

    const profileResponse = await fetch(
      `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`,
      { headers, cache: 'no-store' }
    );
    if (!profileResponse.ok) return null;
    const profiles: unknown = await profileResponse.json();
    if (!Array.isArray(profiles) || !isRecord(profiles[0])) return null;
    const role = profiles[0].role;
    if (role !== 'admin' && role !== 'student') return null;

    const result: Profile = { role };
    const tokenExpMs = payload.exp * 1000;
    const cacheTtlMs = Math.min(Date.now() + 5 * 60 * 1000, tokenExpMs);

    if (profileCache.size > 500) profileCache.clear();
    profileCache.set(token, { profile: result, expiresAt: cacheTtlMs });

    return result;
  } catch {
    const userMeta = isRecord(payload.user_metadata) ? payload.user_metadata : {};
    const fallbackRole = userMeta.role === 'admin' ? 'admin' : 'student';
    return { role: fallbackRole };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isStudentPath = STUDENT_PATHS.some((path) => pathname.startsWith(path));
  const isAdminPath = ADMIN_PATHS.some((path) => pathname.startsWith(path));
  const isAuthPage = pathname === '/signin' || pathname === '/signup';
  const isLandingPage = pathname === '/';
  if (!isStudentPath && !isAdminPath && !isAuthPage && !isLandingPage) return NextResponse.next();

  let profile: Profile | null = null;
  const token = getAccessToken(request);
  if (token) {
    try { profile = await getAuthenticatedProfile(token); } catch { profile = null; }
  }

  if (profile && (isAuthPage || isLandingPage)) {
    return NextResponse.redirect(new URL(profile.role === 'admin' ? '/admin/dashboard' : '/dashboard', request.url));
  }
  if (!profile && (isStudentPath || isAdminPath)) {
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('redirectTo', `${pathname}${search}`);
    return NextResponse.redirect(signInUrl);
  }
  if (isAdminPath && profile?.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}
