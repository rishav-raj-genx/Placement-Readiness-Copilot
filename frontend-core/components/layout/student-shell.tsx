'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BrainCircuit, BriefcaseBusiness, FileSearch, Files, History, LayoutDashboard, LogOut, Menu, Mic2, PanelLeftClose } from 'lucide-react';
import { HireableLogo } from '@/components/brand/hireable-logo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { DemoBanner } from '@/components/shared/demo-banner';
import { TopHeader } from '@/components/layout/top-header';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/review', label: 'Review Engine', icon: FileSearch },
  { href: '/interview/configure', label: 'Interview Studio', icon: Mic2 },
  { href: '/interview/history', label: 'Interview History', icon: History },
  { href: '/jobs', label: 'Jobs Workspace', icon: BriefcaseBusiness },
  { href: '/resources', label: 'Profile & Documents', icon: Files },
] as const;

interface NavigationProps { collapsed?: boolean; onNavigate?: () => void; }

export function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const hydrateProfile = useProfileStore((state) => state.hydrate);
  const resetProfile = useProfileStore((state) => state.reset);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { if (user?.id) void hydrateProfile(user.id); }, [hydrateProfile, user?.id]);

  const Navigation = ({ collapsed: compact = false, onNavigate }: NavigationProps) => (
    <nav aria-label="Student navigation" className="space-y-1">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
        return (
          <Link key={href} href={href} onClick={onNavigate} title={compact ? label : undefined} className={cn('flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors', compact ? 'justify-center px-2' : 'gap-3 px-3', active ? 'bg-indigo-500/15 text-indigo-100 ring-1 ring-inset ring-indigo-400/20' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>
            <Icon className="h-4 w-4 shrink-0" />{!compact && <span>{label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const handleSignOut = async () => { resetProfile(); await signOut(); router.replace('/signin'); router.refresh(); };

  return (
    <div className="min-h-screen">
      <aside className={cn('glass-panel fixed inset-y-0 left-0 z-30 hidden flex-col rounded-none transition-[width] md:flex', collapsed ? 'w-[72px]' : 'w-64')}>
        <div className={cn('relative flex h-16 items-center border-b border-white/10 px-3', collapsed ? 'justify-center' : 'justify-between')}>
          <Link href="/dashboard" className="relative z-10 flex items-center gap-2.5 overflow-hidden">
            <HireableLogo size={32} withGlow priority />
            {!collapsed && <span className="whitespace-nowrap font-semibold">Hireable</span>}
          </Link>
          {!collapsed && <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar"><PanelLeftClose className="h-4 w-4" /></Button>}
          {collapsed && <button type="button" className="absolute inset-0" onClick={() => setCollapsed(false)} aria-label="Expand sidebar" />}
        </div>
        <div className="flex-1 overflow-y-auto p-3"><Navigation collapsed={collapsed} /></div>
        <div className="border-t border-white/10 p-3"><Button variant="ghost" className={cn('text-slate-400 hover:text-white', collapsed ? 'w-full px-0' : 'w-full justify-start')} onClick={() => void handleSignOut()}>{collapsed ? <LogOut className="h-4 w-4" /> : <><LogOut className="mr-2 h-4 w-4" />Sign out</>}</Button></div>
      </aside>
      <div className={cn('min-h-screen transition-[padding] md:pl-64', collapsed && 'md:pl-[72px]')}>
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 backdrop-blur-xl md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Open navigation"><Menu className="h-5 w-5" /></Button></SheetTrigger>
            <SheetContent side="left" className="w-80 border-white/10 bg-slate-950 p-0">
              <SheetHeader className="border-b border-white/10 p-5 text-left"><SheetTitle className="flex items-center gap-2"><HireableLogo size={24} />Hireable</SheetTitle></SheetHeader>
              <div className="p-4"><Navigation onNavigate={() => setMobileOpen(false)} /></div>
            </SheetContent>
          </Sheet>
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold"><HireableLogo size={24} />Hireable</Link><div className="w-10" />
        </div>
        <TopHeader /><DemoBanner />
        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
