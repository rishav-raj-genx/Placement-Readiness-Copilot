'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, PanelLeftClose } from 'lucide-react';
import { HireableLogo } from '@/components/brand/hireable-logo';
import { DASHBOARD_NAV_ITEMS } from '@/components/dashboard/Sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { DemoBanner } from '@/components/shared/demo-banner';
import { TopHeader } from '@/components/layout/top-header';

interface NavigationProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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

  const Navigation = ({ collapsed: compact = false, onNavigate }: NavigationProps) => (
    <nav aria-label="Student navigation" className="space-y-1">
      {DASHBOARD_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={compact ? label : undefined}
            className={cn(
              'flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]',
              compact ? 'justify-center px-2' : 'gap-3 px-3',
              active
                ? 'border-l-2 border-[#D93829] bg-stone-800 text-stone-100 pl-[calc(0.75rem-2px)]'
                : 'text-stone-400 hover:bg-stone-800/60 hover:text-stone-200'
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#D93829]' : 'text-stone-400')} />
            {!compact && <span>{label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const handleSignOut = async () => {
    resetProfile();
    await signOut();
    router.replace('/signin');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#1a1310] text-stone-200">
      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-stone-800 bg-[#28201E] transition-[width] duration-200 md:flex',
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
        <div className="flex-1 overflow-y-auto p-3">
          <Navigation collapsed={collapsed} />
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
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-stone-800 bg-[#28201E]/95 px-4 backdrop-blur-sm md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation" className="text-stone-300 hover:bg-stone-800">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-stone-800 bg-[#28201E] p-0 text-stone-200">
              <SheetHeader className="border-b border-stone-800 p-4 text-left">
                <SheetTitle className="flex items-center gap-2 text-stone-100">
                  <HireableLogo size={24} />
                  <span>Hireable</span>
                </SheetTitle>
              </SheetHeader>
              <div className="p-3">
                <Navigation onNavigate={() => setMobileOpen(false)} />
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
