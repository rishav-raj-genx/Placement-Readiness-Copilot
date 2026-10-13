'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import type { UserRole } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export function AuthGuard({ children, requiredRole = 'student' }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isHydrated } = useAuthStore();

  useEffect(() => {
    if (isHydrated && !user) {
      const redirectUrl = pathname ? `/signin?redirectTo=${encodeURIComponent(pathname)}` : '/signin';
      router.push(redirectUrl);
    }
  }, [isHydrated, user, router, pathname]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Admin users have full access across the system.
  // Student users cannot access admin-only routes.
  const hasAccess = requiredRole === 'admin' ? user.role === 'admin' : true;

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            You do not have administrative permissions to view this page.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">Go to your dashboard</Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
