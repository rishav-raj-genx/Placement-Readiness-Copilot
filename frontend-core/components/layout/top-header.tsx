'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, ChevronDown, LogOut, Settings } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/auth-store';
import { useInterviewStore } from '@/stores/interview-store';
import { useProfileStore } from '@/stores/profile-store';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Readiness command center',
  '/dashboard/interviews': 'Interview history',
  '/dashboard/jobs': 'Job matches',
  '/dashboard/tracker': 'Application tracker',
  '/dashboard/profile': 'Profile settings',
  '/jobs': 'Jobs workspace',
  '/resources': 'Profile & documents',
};

export function TopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
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
  const initials = user?.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'ST';
  const handleSwitchAccount = async () => { await signOut(); router.replace('/signin'); router.refresh(); };

  return (
    <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-white/10 bg-slate-950/70 px-6 backdrop-blur-xl md:flex">
      <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-300">Hireable</p><p className="text-sm text-slate-300">{PAGE_TITLES[pathname] ?? 'Student workspace'}</p></div>
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs text-indigo-200">{typeof score === 'number' ? `${Math.round(score)}% ready` : 'Analysis pending'}</span>
        <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-200">{remainingInterviews} interviews left</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Open notifications"><Bell className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72"><DropdownMenuLabel>Workspace status</DropdownMenuLabel><DropdownMenuSeparator /><p className="px-2 py-2 text-sm text-muted-foreground">{notification}</p></DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" className="gap-2 px-2" aria-label="Open account menu"><Avatar className="h-8 w-8"><AvatarFallback>{initials}</AvatarFallback></Avatar><ChevronDown className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel><span className="block truncate">{user?.displayName}</span><span className="block truncate text-xs font-normal text-muted-foreground">{user?.email}</span></DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/dashboard/profile"><Settings className="mr-2 h-4 w-4" />Profile settings</Link></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void handleSwitchAccount()}><LogOut className="mr-2 h-4 w-4" />Switch account</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
