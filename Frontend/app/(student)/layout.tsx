'use client';

import { StudentShell } from '@/components/layout/student-shell';
import { AuthGuard } from '@/components/layout/auth-guard';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="student">
      <StudentShell>{children}</StudentShell>
    </AuthGuard>
  );
}
