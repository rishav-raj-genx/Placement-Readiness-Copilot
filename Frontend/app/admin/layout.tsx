'use client';

import { AdminShell } from '@/components/layout/admin-shell';
import { AuthGuard } from '@/components/layout/auth-guard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="admin">
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  );
}
