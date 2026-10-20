'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import type { UserRole } from '@/types';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SegmentedLoader } from '@/components/ui/SegmentedLoader';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  fallbackUrl?: string;
  allowGuest?: boolean;
}

/**
 * ProtectedRoute Component
 *
 * Explicit route protection guard. Ensures that only authenticated users
 * with the correct role can view protected routes.
 *
 * Rules:
 *  1. If user is unauthenticated -> redirects to /auth?redirectTo=<pathname> (unless allowGuest)
 *  2. While checking auth state -> renders SegmentedLoader
 *  3. Incomplete students resume the canonical signup flow without touching /onboarding (unless allowGuest)
 *  4. Admins stay in the admin workspace; students cannot access admin routes
 */
export function ProtectedRoute({
  children,
  requiredRole = 'student',
  fallbackUrl = '/auth',
  allowGuest = false,
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isHydrated } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) {
      if (allowGuest) return;
      const redirectTarget = pathname ? `${fallbackUrl}?redirectTo=${encodeURIComponent(pathname)}` : fallbackUrl;
      router.replace(redirectTarget);
      return;
    }
    if (user.role === 'student' && !user.onboardingCompletedAt && !allowGuest) {
      router.replace('/auth?mode=signup&resume=1');
      return;
    }
    if (requiredRole === 'student' && user.role === 'admin') {
      router.replace('/admin-dashboard');
    }
  }, [allowGuest, fallbackUrl, isHydrated, pathname, requiredRole, router, user]);

  if (!isHydrated) {
    return (
      <SegmentedLoader
        message="Building your Copilot..."
        subtitle="Verifying candidate authentication..."
        fullScreen
      />
    );
  }

  if (!user && allowGuest) {
    return <>{children}</>;
  }

  if (!user || (user.role === 'student' && !user.onboardingCompletedAt && !allowGuest)) {
    return null;
  }

  const hasAccess = user.role === requiredRole;

  if (requiredRole === 'student' && user.role === 'admin') {
    return null;
  }

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#1a1310] px-4 text-stone-200">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-stone-800 bg-[#28201E]">
          <ShieldAlert className="h-6 w-6 text-[#D93829]" />
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-bold text-stone-100">Access denied</h1>
          <p className="max-w-sm text-xs text-stone-400">
            You do not have administrative permissions to view this protected page.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" className="rounded-lg border-stone-800 bg-stone-900 text-xs text-stone-300 hover:bg-stone-800 hover:text-stone-100">
            Return to student dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

// Export AuthGuard alias for backward compatibility
export const AuthGuard = ProtectedRoute;
