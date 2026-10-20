import { type NextRequest, NextResponse } from 'next/server';
import { isAdminPathname, resolveAccessRedirect } from '@/lib/auth-routing';
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
