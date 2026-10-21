import type { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AdminShell } from '@/components/layout/admin-shell';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-stone-950 text-stone-200">
        <AdminShell>{children}</AdminShell>
      </div>
    </ProtectedRoute>
  );
}
