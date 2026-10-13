import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware — Server-Side Edge Route Protection
 *
 * Runs on the Edge BEFORE any page renders.
 * Uses lightweight cookie verification to ensure zero leakage of protected
 * routes or server secrets.
 *
 * Route Protection Rules:
 *  1. Unauthenticated users:
 *     - Accessing protected paths (/dashboard, /interview/*, /applications, /jobs, /resources, /admin/*)
 *       -> Redirects to /signin?redirectTo=<full_path_with_query>
 *  2. Role-based protection:
 *     - Accessing /admin/* as a non-admin (e.g. role 'student')
 *       -> Redirects to /dashboard
 *  3. Authenticated users:
 *     - Accessing /signin or /signup or /
 *       -> Redirects to their role-appropriate dashboard (/admin/dashboard or /dashboard)
 *  4. Public assets and API routes:
 *     - Passes through (API routes verify JWT inside their route handlers).
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
  const { pathname, search } = request.nextUrl;

  const isStudentPath = PROTECTED_STUDENT_PATHS.some((p) => pathname.startsWith(p));
  const isAdminPath = PROTECTED_ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPage = pathname === '/signin' || pathname === '/signup';
  const isLandingPage = pathname === '/';

  // If this path is not protected and not an auth/landing page, let it pass immediately
  if (!isStudentPath && !isAdminPath && !isAuthPage && !isLandingPage) {
    return NextResponse.next();
  }

  // ── 1. Read Demo session ───────────────────────────────────────────────────
  const demoCookie = request.cookies.get('demo-session')?.value;
  const isDemoAuthenticated = demoCookie === 'student' || demoCookie === 'admin';

  // ── 2. Read Supabase session from cookies ──────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const projectCookie = projectRef ? request.cookies.get(`sb-${projectRef}-auth-token`)?.value : null;
  const customAuthCookie = request.cookies.get('sb-auth-token')?.value;

  const rawAuthCookie = customAuthCookie || projectCookie;
  let isSupabaseAuthenticated = false;

  if (rawAuthCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(rawAuthCookie));
      const session = Array.isArray(parsed) ? parsed[0] : parsed;
      isSupabaseAuthenticated = !!(session?.access_token || session?.user_id);
    } catch {
      isSupabaseAuthenticated = false;
    }
  }

  const isAuthenticated = isDemoAuthenticated || isSupabaseAuthenticated;

  // ── 3. Determine User Role ─────────────────────────────────────────────────
  const roleCookie = request.cookies.get('sb-user-role')?.value;
  let userRole: 'student' | 'admin' = 'student';
  if (demoCookie === 'admin' || roleCookie === 'admin') {
    userRole = 'admin';
  }

  // ── 4. Redirect logged-in users away from auth pages and landing page ──────
  if (isAuthenticated && (isAuthPage || isLandingPage)) {
    const dest = userRole === 'admin' ? '/admin/dashboard' : '/dashboard';
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // ── 5. Redirect unauthenticated users away from protected routes ───────────
  if (!isAuthenticated && (isStudentPath || isAdminPath)) {
    const fullPath = search ? `${pathname}${search}` : pathname;
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('redirectTo', fullPath);
    return NextResponse.redirect(signInUrl);
  }

  // ── 6. Enforce Role Protection: Non-admin users cannot access /admin ──────
  if (isAdminPath && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}
