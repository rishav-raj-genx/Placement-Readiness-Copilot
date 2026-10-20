'use client';

import { usePathname } from 'next/navigation';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useAuthStore } from '@/stores/auth-store';
import { useInterviewStore } from '@/stores/interview-store';
import { useProfileStore } from '@/stores/profile-store';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard/interviews': 'Interview history',
  '/dashboard/interview': 'Interview studio',
  '/dashboard/jobs': 'Job matches',
  '/dashboard/tracker': 'Application tracker',
  '/dashboard/profile': 'Profile settings',
  '/jobs': 'Jobs workspace',
  '/resources': 'Profile & documents',
};

function getPageTitle(pathname: string): string | null {
  if (pathname === '/dashboard') return null;
  if (pathname.startsWith('/dashboard/interview/')) return 'Interview studio';
  return PAGE_TITLES[pathname] ?? 'Student workspace';
}

export function TopHeader() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const readiness = useProfileStore((state) => state.readiness);
  const remainingInterviews = useInterviewStore((state) => state.getRemainingCount());
  const score = readiness?.totalScore;
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-white/10 bg-slate-950/70 px-6 backdrop-blur-xl md:flex">
      {pageTitle && <p className="text-sm font-medium text-slate-300">{pageTitle}</p>}
      <div className="ml-auto flex items-center gap-2">
        <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs text-indigo-200">
          {user ? (typeof score === 'number' ? `${Math.round(score)}% ready` : 'Analysis pending') : 'Preview Mode'}
        </span>
        <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-200">
          {user ? `${remainingInterviews} interviews left` : '3 free interviews'}
        </span>
        <NotificationBell />
      </div>
    </header>
  );
}
