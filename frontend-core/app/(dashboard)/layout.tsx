'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { HireableLogo } from '@/components/brand/hireable-logo';
import { DashboardNavigation, DashboardSidebar } from '@/components/dashboard/Sidebar';
import { TopHeader } from '@/components/layout/top-header';
import { PageTransition } from '@/components/motion/page-transition';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useApplicationStore } from '@/stores/application-store';
import { useJobStore } from '@/stores/job-store';
import { useProfileStore } from '@/stores/profile-store';
import { SegmentedLoader } from '@/components/ui/SegmentedLoader';
import { isGuestPreviewPathname } from '@/lib/auth-routing';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrateProfile = useProfileStore((state) => state.hydrate);
  const analyzeProfile = useProfileStore((state) => state.analyze);
  const hydrateApplications = useApplicationStore((state) => state.hydrate);
  const hydrateJobs = useJobStore((state) => state.hydrate);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bootstrappedUserId, setBootstrappedUserId] = useState<string | null>(null);
  const allowGuest = isGuestPreviewPathname(pathname);

  useEffect(() => {
    if (!isHydrated) hydrateAuth();
  }, [hydrateAuth, isHydrated]);

  useEffect(() => {
    if (!user?.id || !user.onboardingCompletedAt) {
      setBootstrappedUserId(null);
      return;
    }

    let active = true;
    const userId = user.id;
    setBootstrappedUserId(null);

    const bootstrap = async (): Promise<void> => {
      await Promise.all([
        hydrateProfile(userId),
        hydrateApplications(userId),
      ]);

      const profileState = useProfileStore.getState();
      const candidate = profileState.profile ?? user;
      const needsInitialAnalysis = Boolean(profileState.profile) && (
        !profileState.review
        || profileState.review.status === 'failed'
        || !profileState.readiness
      );

      await Promise.all([
        hydrateJobs({ targetRole: candidate.targetRole ?? '', skills: candidate.skills }),
        needsInitialAnalysis ? analyzeProfile(userId) : Promise.resolve(),
      ]);

      if (active) setBootstrappedUserId(userId);
    };

    void bootstrap();
    return () => { active = false; };
  }, [analyzeProfile, hydrateApplications, hydrateJobs, hydrateProfile, user]);

  const dataReady = (!user && allowGuest) || Boolean(user?.id && bootstrappedUserId === user.id);

  return (
    <ProtectedRoute requiredRole="student" allowGuest={allowGuest}>
      <div className="relative min-h-screen bg-background text-foreground">
        <DashboardSidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />

        <div className={cn('relative z-10 min-h-screen transition-[padding] duration-300 lg:pl-72', collapsed && 'lg:pl-[92px]')}>
          <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-stone-800 bg-stone-950 px-4 md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
              <button type="button" aria-label="Open dashboard navigation" className="grid h-10 w-10 place-items-center rounded-xl border border-stone-800 bg-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"><Menu className="h-5 w-5" /></button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[19rem] border-stone-800 bg-stone-950 p-0">
                <SheetHeader className="border-b border-stone-800 p-5 text-left"><SheetTitle className="flex items-center gap-2.5 text-stone-100"><HireableLogo size={28} withGlow />Hireable</SheetTitle></SheetHeader>
                <div className="p-4"><DashboardNavigation onNavigate={() => setMobileOpen(false)} /></div>
              </SheetContent>
            </Sheet>
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold"><HireableLogo size={25} />Hireable</Link>
          </div>

          <TopHeader />
          <main className="mx-auto w-full max-w-[1600px] p-4 pb-32 sm:p-6 sm:pb-32 lg:p-8 lg:pb-32">
            <PageTransition>
              {dataReady ? children : (
                <SegmentedLoader
                  message="Building your Copilot..."
                  subtitle="Parsing profile evidence and matching opportunities..."
                  fullScreen
                />
              )}
            </PageTransition>
          </main>
        </div>

        {!user && allowGuest && (
          <div className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-4 rounded-2xl border border-stone-800 bg-stone-950 px-6 py-4 shadow-md shadow-black/40">
            <div>
              <h4 className="font-semibold text-stone-100">You are in preview mode</h4>
              <p className="text-sm text-stone-400">Create an account to take interviews and apply for jobs.</p>
            </div>
            <Link className="whitespace-nowrap rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-500" href="/auth">
              Create account
            </Link>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
