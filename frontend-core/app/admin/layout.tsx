'use client';

import { AdminShell } from '@/components/layout/admin-shell';
import { ProtectedRoute } from '@/components/auth/protected-route';

/**
 * Admin Route Group Layout
 * All routes under /admin — /admin/dashboard, /admin/jobs —
 * are strictly wrapped in ProtectedRoute with requiredRole="admin".
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminShell>{children}</AdminShell>
    </ProtectedRoute>
  );
}
