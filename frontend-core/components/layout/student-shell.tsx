'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Menu, PanelLeftClose } from 'lucide-react';
import { HireableLogo } from '@/components/brand/hireable-logo';
import { DashboardNavigation } from '@/components/dashboard/Sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { DemoBanner } from '@/components/shared/demo-banner';
import { TopHeader } from '@/components/layout/top-header';

export function StudentShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const hydrateProfile = useProfileStore((state) => state.hydrate);
  const resetProfile = useProfileStore((state) => state.reset);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (user?.id) void hydrateProfile(user.id);
  }, [hydrateProfile, user?.id]);

  const handleSignOut = async () => {
    resetProfile();
    await signOut();
    router.replace('/signin');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#1a1310] text-stone-200">
      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-stone-800 bg-stone-950 transition-[width] duration-200 md:flex',
        collapsed ? 'w-[72px]' : 'w-64'
      )}>
        <div className={cn(
          'relative flex h-14 items-center border-b border-stone-800 px-3',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          <Link href="/dashboard" className="relative z-10 flex items-center gap-2.5 overflow-hidden">
            <HireableLogo size={30} priority />
            {!collapsed && <span className="whitespace-nowrap font-bold text-stone-100">Hireable</span>}
          </Link>
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="text-stone-400 hover:bg-stone-800 hover:text-stone-200"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
          {collapsed && (
            <button
              type="button"
              className="absolute inset-0"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
            />
          )}
        </div>
        <div className="flex-1 flex flex-col justify-center overflow-y-auto p-3">
          <DashboardNavigation collapsed={collapsed} />
        </div>
        <div className="border-t border-stone-800 p-3">
          <Button
            variant="ghost"
            className={cn(
              'text-stone-400 hover:bg-stone-800 hover:text-[#D93829]',
              collapsed ? 'w-full px-0' : 'w-full justify-start'
            )}
            onClick={() => void handleSignOut()}
          >
            {collapsed ? <LogOut className="h-4 w-4" /> : <><LogOut className="mr-2 h-4 w-4" />Sign out</>}
          </Button>
        </div>
      </aside>
      <div className={cn('min-h-screen transition-[padding] duration-200 md:pl-64', collapsed && 'md:pl-[72px]')}>
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-stone-800 bg-stone-950/95 px-4 backdrop-blur-sm md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation" className="text-stone-300 hover:bg-stone-800">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-stone-800 bg-stone-950 p-0 text-stone-200">
              <SheetHeader className="border-b border-stone-800 p-4 text-left">
                <SheetTitle className="flex items-center gap-2 text-stone-100">
                  <HireableLogo size={24} />
                  <span>Hireable</span>
                </SheetTitle>
              </SheetHeader>
              <div className="p-3">
                <DashboardNavigation onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-stone-100">
            <HireableLogo size={24} />
            Hireable
          </Link>
          <div className="w-10" />
        </div>
        <TopHeader />
        <DemoBanner />
        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
