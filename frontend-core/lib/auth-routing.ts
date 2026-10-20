import type { UserRole } from '@/types';

const STUDENT_PATHS = ['/dashboard', '/interview', '/interviews', '/applications', '/jobs', '/tracker', '/profile', '/resources'];

export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const url = new URL(value, 'https://prepcopilot.local');
    return url.origin === 'https://prepcopilot.local'
      ? `${url.pathname}${url.search}${url.hash}`
      : null;
  } catch {
    return null;
  }
}

interface DestinationInput {
  role: UserRole;
  onboardingCompleted: boolean;
  requestedPath?: string | null;
}

export function getAuthenticatedDestination({
  role,
  onboardingCompleted,
  requestedPath,
}: DestinationInput): string {
  if (role === 'admin') return '/admin/dashboard';
  if (!onboardingCompleted) return '/auth?mode=signup&resume=1';
  const safePath = safeInternalPath(requestedPath);
  if (
    safePath?.startsWith('/admin')
    || safePath?.startsWith('/onboarding')
    || safePath?.startsWith('/auth')
    || safePath?.startsWith('/signin')
    || safePath?.startsWith('/signup')
  ) return '/dashboard';
  return safePath ?? '/dashboard';
}

interface AccessRedirectInput {
  pathname: string;
  search?: string;
  authenticated: boolean;
  role?: UserRole;
  onboardingCompleted?: boolean;
}

export function resolveAccessRedirect({
  pathname,
  search = '',
  authenticated,
  role = 'student',
  onboardingCompleted = false,
}: AccessRedirectInput): string | null {
  const isStudentPath = STUDENT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');
  const isOnboardingPath = pathname === '/onboarding' || pathname.startsWith('/onboarding/');
  const isAuthPath = ['/auth', '/signin', '/signup', '/login'].some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isLandingPage = pathname === '/';

  if (!isStudentPath && !isAdminPath && !isOnboardingPath && !isAuthPath && !isLandingPage) return null;

  if (!authenticated) {
    if (isLandingPage) return null;
    if (!isStudentPath && !isAdminPath && !isOnboardingPath) return null;
    return `/auth?redirectTo=${encodeURIComponent(`${pathname}${search}`)}`;
  }

  if (role === 'admin') {
    return isStudentPath || isOnboardingPath || isAuthPath || isLandingPage ? '/admin/dashboard' : null;
  }

  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const isResumeSignup = pathname === '/auth' && query.get('mode') === 'signup' && query.get('resume') === '1';

  if (!onboardingCompleted) {
    if (isResumeSignup) return null;
    return isStudentPath || isAdminPath || isOnboardingPath || isAuthPath || isLandingPage
      ? '/auth?mode=signup&resume=1'
      : null;
  }

  if (isAdminPath || isOnboardingPath || isAuthPath || isLandingPage) return '/dashboard';
  return null;
}
