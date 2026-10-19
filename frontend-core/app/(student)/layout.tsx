'use client';

import { StudentShell } from '@/components/layout/student-shell';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { PageTransition } from '@/components/motion/page-transition';

/**
 * Student Route Group Layout
 * All routes under (student) — /dashboard, /interview/*, /applications, /jobs, /resources —
 * are strictly wrapped in ProtectedRoute.
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="student">
      <StudentShell><PageTransition>{children}</PageTransition></StudentShell>
    </ProtectedRoute>
  );
}
