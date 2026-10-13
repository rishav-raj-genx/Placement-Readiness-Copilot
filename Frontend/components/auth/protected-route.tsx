'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import type { UserRole } from '@/types';
import { ShieldAlert, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  fallbackUrl?: string;
}

/**
 * ProtectedRoute Component
 *
 * Explicit route protection guard. Ensures that only authenticated users
 * with the correct role can view protected routes.
 *
 * Rules:
 *  1. If user is unauthenticated -> redirects immediately to /signin?redirectTo=<pathname>
 *  2. While checking auth state -> renders clean verification skeleton
 *  3. If user lacks required role -> displays Access Denied screen
 */
export function ProtectedRoute({
  children,
  requiredRole = 'student',
  fallbackUrl = '/signin',
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isHydrated } = useAuthStore();

  useEffect(() => {
    if (isHydrated && !user) {
      const redirectTarget = pathname
        ? `${fallbackUrl}?redirectTo=${encodeURIComponent(pathname)}`
        : fallbackUrl;
      router.push(redirectTarget);
    }
  }, [isHydrated, user, router, pathname, fallbackUrl]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 border border-brand/20 animate-pulse">
          <Lock className="h-5 w-5 text-brand" />
        </div>
        <p className="text-xs text-muted-foreground animate-pulse">Verifying authentication...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Admin users have full system access; students cannot access admin routes
  const hasAccess = requiredRole === 'admin' ? user.role === 'admin' : true;

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 bg-background">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            You do not have administrative permissions to view this protected page.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">Go to Student Dashboard</Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

// Export AuthGuard alias for backward compatibility
export const AuthGuard = ProtectedRoute;
