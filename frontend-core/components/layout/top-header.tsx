'use client';

import { usePathname } from 'next/navigation';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { cn } from '@/lib/utils';
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

  const formattedCredits = credits === 1 ? '1 interview left' : `${credits} interviews left`;

  return (
    <header className="sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-stone-800 bg-stone-950/95 px-6 backdrop-blur-sm md:flex">
      {pageTitle && <p className="text-sm font-semibold text-stone-200">{pageTitle}</p>}
      <div className="ml-auto flex items-center gap-2">
        <span className="rounded-md border border-stone-700 bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-200">
          {user ? (typeof score === 'number' ? `${Math.round(score)}% ready` : 'Analysis pending') : 'Preview mode'}
        </span>
        {isPremium ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            Premium Active
          </span>
        ) : (
          <span
            data-testid="interview-credits-counter"
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              credits <= 0
                ? 'border-[#D93829]/50 bg-[#D93829]/15 text-[#FF6B4A] font-semibold shadow-[0_0_12px_rgba(217,56,41,0.25)]'
                : 'border-stone-700 bg-stone-800 text-stone-300'
            )}
          >
            {user ? formattedCredits : '3 free interviews'}
          </span>
        )}
        <NotificationBell />
      </div>
    </header>
  );
}
