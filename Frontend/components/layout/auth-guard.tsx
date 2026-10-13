'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const { user, isHydrated } = useAuthStore();

  useEffect(() => {
    if (isHydrated && !user) {
      router.push('/signin');
    }
  }, [isHydrated, user, router]);

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

  if (user.role !== requiredRole) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view this page.
          </p>
        </div>
        <Link href={user.role === 'admin' ? '/admin/dashboard' : '/dashboard'}>
          <Button variant="outline">Go to your dashboard</Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
