'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
      const needsInitialAnalysis = Boolean(profileState.profile) && (!profileState.review || !profileState.readiness);

      await Promise.all([
        hydrateJobs({ targetRole: candidate.targetRole ?? '', skills: candidate.skills }),
        needsInitialAnalysis ? analyzeProfile(userId) : Promise.resolve(),
      ]);

      if (active) setBootstrappedUserId(userId);
    };

    void bootstrap();
    return () => { active = false; };
  }, [analyzeProfile, hydrateApplications, hydrateJobs, hydrateProfile, user]);

  const dataReady = Boolean(user?.id && bootstrappedUserId === user.id);

  return (
    <ProtectedRoute requiredRole="student">
      <div className="relative min-h-screen bg-[#0B0F17] text-white">
        <DashboardSidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />

        <div className={cn('relative z-10 min-h-screen transition-[padding] duration-300 lg:pl-72', collapsed && 'lg:pl-[92px]')}>
          <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#0B0F17]/85 px-4 backdrop-blur-xl md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button type="button" aria-label="Open dashboard navigation" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><Menu className="h-5 w-5" /></button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[19rem] border-white/10 bg-[#0B0F17] p-0">
                <SheetHeader className="border-b border-white/10 p-5 text-left"><SheetTitle className="flex items-center gap-2.5 text-white"><HireableLogo size={28} withGlow />Hireable</SheetTitle></SheetHeader>
                <div className="p-4"><DashboardNavigation onNavigate={() => setMobileOpen(false)} /></div>
              </SheetContent>
            </Sheet>
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold"><HireableLogo size={25} />Hireable</Link>
            <Link href="/dashboard/profile" aria-label="Open profile settings" className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 font-mono text-xs font-bold">{user?.displayName?.[0]?.toUpperCase() ?? 'C'}</Link>
          </div>

          <TopHeader />
          <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
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
      </div>
    </ProtectedRoute>
  );
}
