import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware — Server-Side Route Protection (Edge Runtime)
 *
 * Runs on the edge BEFORE any page renders. Uses lightweight cookie checks
 * only — no Supabase SDK imports (they use Node.js APIs not available in Edge).
 *
 * Rules:
 *  - /admin/*    → must be authenticated (role verified in AuthGuard / API route)
 *  - /(student)/* → must be authenticated
 *  - /signin, /signup → redirect to /dashboard if already logged in
 *  - /api/livekit/* → must be authenticated (JWT check done inside the route)
 *  - Everything else → pass through
 */

const PROTECTED_STUDENT_PATHS = [
  '/dashboard',
  '/interview',
  '/applications',
  '/jobs',
  '/resources',
];

const PROTECTED_ADMIN_PATHS = ['/admin'];

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isStudentPath = PROTECTED_STUDENT_PATHS.some((p) => pathname.startsWith(p));
  const isAdminPath = PROTECTED_ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPage = pathname === '/signin' || pathname === '/signup';
  const isLandingPage = pathname === '/';

  if (!isStudentPath && !isAdminPath && !isAuthPage && !isLandingPage) {
    return NextResponse.next();
  }

  // ── Read Supabase session from cookie ──────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const cookieName = projectRef ? `sb-${projectRef}-auth-token` : null;
  const rawCookie = cookieName ? request.cookies.get(cookieName)?.value : null;

  let isAuthenticated = false;
  if (rawCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(rawCookie));
      const session = Array.isArray(parsed) ? parsed[0] : parsed;
      isAuthenticated = !!session?.access_token;
    } catch {
      isAuthenticated = false;
    }
  }

  // ── Demo mode ──────────────────────────────────────────────────────────────
  const demoSession = request.cookies.get('demo-session')?.value;
  const isDemoAuthenticated = demoSession === 'student' || demoSession === 'admin';

  // Redirect authenticated users away from auth pages AND the landing page
  if ((isAuthPage || isLandingPage) && (isAuthenticated || isDemoAuthenticated)) {
    const dest = demoSession === 'admin' ? '/admin/dashboard' : '/dashboard';
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if ((isStudentPath || isAdminPath) && !isAuthenticated && !isDemoAuthenticated) {
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAdminPath && isDemoAuthenticated && demoSession !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}
