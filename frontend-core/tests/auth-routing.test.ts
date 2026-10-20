import { describe, expect, it } from 'vitest';
import {
  getAuthenticatedDestination,
  isAdminPathname,
  resolveAccessRedirect,
  safeInternalPath,
} from '@/lib/auth-routing';

describe('safe auth routing', () => {
  it('rejects external and protocol-relative redirects', () => {
    expect(safeInternalPath('//evil.example')).toBeNull();
    expect(safeInternalPath('https://evil.example')).toBeNull();
  });
  it('gates incomplete students and keeps admins in admin', () => {
    expect(getAuthenticatedDestination({ role: 'student', onboardingCompleted: false, requestedPath: '/jobs' })).toBe('/auth?mode=signup&resume=1');
    expect(getAuthenticatedDestination({ role: 'student', onboardingCompleted: true, requestedPath: '/jobs?tab=tracker' })).toBe('/jobs?tab=tracker');
    expect(getAuthenticatedDestination({ role: 'student', onboardingCompleted: true, requestedPath: '/signin' })).toBe('/dashboard');
    expect(getAuthenticatedDestination({ role: 'student', onboardingCompleted: true, requestedPath: '/auth?mode=signup' })).toBe('/dashboard');
    expect(getAuthenticatedDestination({ role: 'student', onboardingCompleted: true, requestedPath: '/onboarding/legacy' })).toBe('/dashboard');
    expect(getAuthenticatedDestination({ role: 'admin', onboardingCompleted: false, requestedPath: '/dashboard' })).toBe('/admin-dashboard');
  });

  it('protects legacy onboarding without creating a redirect loop', () => {
    expect(resolveAccessRedirect({ pathname: '/onboarding', authenticated: false })).toBe('/auth?redirectTo=%2Fonboarding');
    expect(resolveAccessRedirect({ pathname: '/onboarding', authenticated: true, role: 'student', onboardingCompleted: false })).toBe('/auth?mode=signup&resume=1');
    expect(resolveAccessRedirect({ pathname: '/auth', search: '?mode=signup&resume=1', authenticated: true, role: 'student', onboardingCompleted: false })).toBeNull();
    expect(resolveAccessRedirect({ pathname: '/onboarding', authenticated: true, role: 'student', onboardingCompleted: true })).toBe('/dashboard');
  });

  it('keeps the prominent dashboard behind authentication', () => {
    expect(resolveAccessRedirect({ pathname: '/', authenticated: false })).toBeNull();
    expect(resolveAccessRedirect({ pathname: '/dashboard/jobs', search: '?tab=tracker', authenticated: false })).toBe('/auth?redirectTo=%2Fdashboard%2Fjobs%3Ftab%3Dtracker');
    expect(resolveAccessRedirect({ pathname: '/dashboard', authenticated: false })).toBe('/auth?redirectTo=%2Fdashboard');
    expect(resolveAccessRedirect({ pathname: '/dashboard', authenticated: true, role: 'student', onboardingCompleted: false })).toBe('/auth?mode=signup&resume=1');
    expect(resolveAccessRedirect({ pathname: '/dashboard', authenticated: true, role: 'student', onboardingCompleted: true })).toBeNull();
    expect(resolveAccessRedirect({ pathname: '/dashboard', authenticated: true, role: 'admin', onboardingCompleted: true })).toBe('/admin-dashboard');
  });

  it('protects every canonical admin route and fails closed for students', () => {
    const adminPaths = ['/admin-dashboard', '/admin-jobs', '/admin-interviews'];

    for (const pathname of adminPaths) {
      expect(resolveAccessRedirect({ pathname, authenticated: false })).toBe(
        `/auth?redirectTo=${encodeURIComponent(pathname)}`
      );
      expect(resolveAccessRedirect({
        pathname,
        authenticated: true,
        role: 'student',
        onboardingCompleted: true,
      })).toBe('/dashboard');
      expect(resolveAccessRedirect({
        pathname,
        authenticated: true,
        role: 'student',
        onboardingCompleted: false,
      })).toBe('/dashboard');
      expect(resolveAccessRedirect({
        pathname,
        authenticated: true,
        role: 'admin',
        onboardingCompleted: false,
      })).toBeNull();
    }

    expect(isAdminPathname('/admin-dashboard/settings')).toBe(true);
    expect(isAdminPathname('/administrator')).toBe(false);
  });

  it('does not retain the deleted review route in protected routing', () => {
    expect(resolveAccessRedirect({ pathname: '/review', authenticated: false })).toBeNull();
  });
});
