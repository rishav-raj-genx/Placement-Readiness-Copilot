import { type NextRequest, NextResponse } from 'next/server';
import { isAdminPathname, isGuestPreviewPathname, resolveAccessRedirect } from '@/lib/auth-routing';
import { createMiddlewareSessionClient } from '@/lib/supabase-session-server';

interface ProfileAccess {
  role: 'student' | 'admin';
  onboardingCompleted: boolean;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

function redirectWithCookies(
  destination: string,
  request: NextRequest,
  sourceResponse: NextResponse
): NextResponse {
  const response = NextResponse.redirect(new URL(destination, request.url));
  for (const cookie of sourceResponse.cookies.getAll()) {
    response.cookies.set(cookie.name, cookie.value, cookie);
  }
  return response;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request });
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/api/') || pathname === '/auth/callback') {
    return response;
  }

  // The landing page is always public. Client-side session state decides whether
  // to show the intro or continue an authenticated user to their dashboard.
  if (pathname === '/') {
    return response;
  }

  let userId: string | null = null;
  let profile: ProfileAccess | null = null;

  try {
    const supabase = createMiddlewareSessionClient(request, response);
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;

    if (userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, onboarding_completed_at')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        profile = {
          role: data.role === 'admin' ? 'admin' : 'student',
          onboardingCompleted: Boolean(data.onboarding_completed_at),
        };
      }
    }
  } catch {
    userId = null;
  }

  if (userId && !profile) {
    profile = { role: 'student', onboardingCompleted: false };
  }

  if (!userId && (pathname === '/auth' || pathname.startsWith('/auth/'))) {
    return response;
  }

  // Intercept protected modules for guests and explicitly route to auth
  const isProtectedGuestRoute =
    !userId &&
    (pathname.startsWith('/admin') ||
      pathname === '/dashboard/interview' ||
      pathname.startsWith('/dashboard/interview/') ||
      pathname === '/dashboard/job-matches' ||
      pathname.startsWith('/dashboard/job-matches/') ||
      pathname === '/dashboard/applications' ||
      pathname.startsWith('/dashboard/applications/') ||
      pathname === '/dashboard/tracker' ||
      pathname.startsWith('/dashboard/tracker/') ||
      pathname === '/dashboard/action-plan' ||
      pathname.startsWith('/dashboard/action-plan/') ||
      pathname === '/dashboard/interviews' ||
      pathname.startsWith('/dashboard/interviews/'));

  if (isProtectedGuestRoute) {
    const redirectUrl = new URL('/auth', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Do NOT redirect if pathname is exactly '/dashboard' or '/dashboard/jobs'
  if (!userId && (pathname === '/dashboard' || pathname === '/dashboard/jobs' || isGuestPreviewPathname(pathname))) {
    return response;
  }

  if (userId && profile?.role !== 'admin' && isAdminPathname(pathname)) {
    return redirectWithCookies('/dashboard', request, response);
  }

  const destination = resolveAccessRedirect({
    pathname,
    search,
    authenticated: Boolean(userId),
    role: profile?.role,
    onboardingCompleted: profile?.onboardingCompleted,
  });

  return destination
    ? redirectWithCookies(destination, request, response)
    : response;
}
