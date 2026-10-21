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
  const profile = useProfileStore((state) => state.profile);
  const isPremium = profile?.isPremium === true;
  const credits = typeof profile?.interviewCredits === 'number'
    ? profile.interviewCredits
    : remainingInterviews;
  const score = readiness?.totalScore;
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-stone-800 bg-[#28201E]/95 px-6 backdrop-blur-sm md:flex">
      {pageTitle && <p className="text-sm font-semibold text-stone-200">{pageTitle}</p>}
      <div className="ml-auto flex items-center gap-2">
        <span className="rounded-md border border-stone-700 bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-200">
          {user ? (typeof score === 'number' ? `${Math.round(score)}% ready` : 'Analysis pending') : 'Preview mode'}
        </span>
        {isPremium ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            Premium Active
          </span>
        ) : (
          <span className="rounded-md border border-stone-700 bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-300">
            {user ? `${credits} interviews left` : '3 free interviews'}
          </span>
        )}
        <NotificationBell />
      </div>
    </header>
  );
}
