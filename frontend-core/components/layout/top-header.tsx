'use client';

import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  const review = useProfileStore((state) => state.review);
  const readiness = useProfileStore((state) => state.readiness);
  const remainingInterviews = useInterviewStore((state) => state.getRemainingCount());
  const score = readiness?.totalScore;
  const notification = review?.status === 'failed'
    ? 'Profile analysis needs attention.'
    : review?.status === 'processing'
      ? 'Profile analysis is still processing.'
      : review?.status === 'completed'
        ? 'Your latest profile review is ready.'
        : 'Complete a profile review to generate recommendations.';
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-white/10 bg-slate-950/70 px-6 backdrop-blur-xl md:flex">
      {pageTitle && <p className="text-sm font-medium text-slate-300">{pageTitle}</p>}
      <div className="ml-auto flex items-center gap-2">
        <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs text-indigo-200">{typeof score === 'number' ? `${Math.round(score)}% ready` : 'Analysis pending'}</span>
        <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-200">{remainingInterviews} interviews left</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Open notifications"><Bell className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72"><DropdownMenuLabel>Workspace status</DropdownMenuLabel><DropdownMenuSeparator /><p className="px-2 py-2 text-sm text-muted-foreground">{notification}</p></DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
