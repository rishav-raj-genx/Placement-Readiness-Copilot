import { NextRequest, NextResponse } from 'next/server';

const STUDENT_PATHS = ['/dashboard', '/interview', '/applications', '/jobs', '/resources'];
const ADMIN_PATHS = ['/admin'];

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

type Profile = { role: 'student' | 'admin' };

function getAccessToken(request: NextRequest): string | null {
  const raw = request.cookies.get('sb-auth-token')?.value;
  if (!raw) return null;
  try {
    const session = JSON.parse(decodeURIComponent(raw));
    return typeof session?.access_token === 'string' ? session.access_token : null;
  } catch {
    return null;
  }
}

async function getAuthenticatedProfile(token: string): Promise<Profile | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;

  const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers, cache: 'no-store' });
  if (!userResponse.ok) return null;
  const user = (await userResponse.json()) as { id?: string };
  if (!user.id) return null;

  const profileResponse = await fetch(
    `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`,
    { headers, cache: 'no-store' }
  );
  if (!profileResponse.ok) return null;
  const profiles = (await profileResponse.json()) as Profile[];
  return profiles[0]?.role === 'admin' || profiles[0]?.role === 'student' ? profiles[0] : null;
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
