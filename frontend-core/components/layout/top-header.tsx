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
    <header className="sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-stone-800 bg-[#28201E]/95 px-6 backdrop-blur-sm md:flex">
      {pageTitle && <p className="text-sm font-semibold text-stone-200">{pageTitle}</p>}
      <div className="ml-auto flex items-center gap-2">
        <span className="rounded-md border border-stone-700 bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-200">
          {user ? (typeof score === 'number' ? `${Math.round(score)}% ready` : 'Analysis pending') : 'Preview mode'}
        </span>
        <span className="rounded-md border border-stone-700 bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-300">
          {user ? `${remainingInterviews} interviews left` : '3 free interviews'}
        </span>
        <NotificationBell />
      </div>
    </header>
  );
}
