'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  Menu,
  Mic2,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { HireableLogo } from '@/components/brand/hireable-logo';
import { PageTransition } from '@/components/motion/page-transition';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

export const ADMIN_NAV_ITEMS = [
  { href: '/admin-dashboard', label: 'Command center', icon: Building2 },
  { href: '/admin-jobs', label: 'Post jobs', icon: BriefcaseBusiness },
  { href: '/admin-interviews', label: 'Review vivas', icon: Mic2 },
] as const;

interface AdminShellProps {
  children: React.ReactNode;
}

interface AdminNavigationProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

interface AdminAccountProps {
  collapsed?: boolean;
  displayName: string;
  initials: string;
  isSigningOut: boolean;
  onSignOut: () => void;
}

function AdminNavigation({ collapsed = false, onNavigate }: AdminNavigationProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <nav aria-label="MSOT staff navigation" className="space-y-1.5">
      {ADMIN_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex min-h-11 items-center rounded-xl text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#D93829]',
              collapsed ? 'justify-center px-2' : 'gap-3 px-3.5',
              active ? 'text-stone-100' : 'text-stone-400 hover:bg-stone-800/60 hover:text-stone-200',
            )}
          >
            {active && (
              <motion.span
                layoutId="admin-active-route"
                className="absolute inset-0 rounded-xl border border-stone-700 bg-stone-800/80 shadow-none"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 25 }}
              />
            )}
            <Icon
              className={cn(
                'relative z-10 h-5 w-5 shrink-0 transition-colors',
                active ? 'text-[#D93829]' : 'text-stone-400 group-hover:text-stone-200',
              )}
              aria-hidden="true"
            />
            {!collapsed && <span className="relative z-10 truncate">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminAccount({
  collapsed = false,
  displayName,
  initials,
  isSigningOut,
  onSignOut,
}: AdminAccountProps) {
  return (
    <div className="border-t border-stone-800 p-3">
      <div className={cn(
        'flex items-center rounded-xl border border-stone-800 bg-stone-900/60 p-2.5',
        collapsed ? 'justify-center' : 'gap-2.5',
      )}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-stone-700 bg-stone-800 font-mono text-xs font-semibold text-stone-200">
          {initials}
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-stone-200">{displayName}</p>
            <p className="mt-0.5 font-mono text-xs uppercase tracking-wider text-stone-400">Administrator</p>
          </div>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut}
            aria-label="Sign out"
            title="Sign out"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-800 hover:text-[#D93829] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSigningOut
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <LogOut className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>
      {collapsed && (
        <button
          type="button"
          onClick={onSignOut}
          disabled={isSigningOut}
          aria-label="Sign out"
          title="Sign out"
          className="mx-auto mt-2 grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-800 hover:text-[#D93829] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSigningOut
            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            : <LogOut className="h-4 w-4" aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}

export function AdminShell({ children }: AdminShellProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = user?.displayName || 'MSOT Administrator';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'MS';

  const handleSignOut = async (): Promise<void> => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      await signOut();
      const authError = useAuthStore.getState().error;
      if (authError) toast.error(authError);
      else toast.success('Signed out successfully');
    } finally {
      setMobileOpen(false);
      router.replace('/auth');
      router.refresh();
      setIsSigningOut(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#1a1310] text-stone-200">
      <aside className={cn(
        'fixed bottom-4 left-4 top-4 z-40 hidden flex-col rounded-2xl border border-stone-800 bg-[#28201E] shadow-lg shadow-black/50 transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[72px]' : 'w-64',
      )}>
        <div className={cn(
          'flex min-h-20 items-center border-b border-stone-800 px-4',
          collapsed ? 'justify-center' : 'justify-between gap-3',
        )}>
          <Link
            href="/admin-dashboard"
            className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
          >
            <HireableLogo size={32} priority />
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-[var(--font-display)] text-base font-bold tracking-tight text-stone-100">Hireable</p>
                <span className="mt-0.5 inline-flex items-center gap-1 rounded border border-stone-700 bg-stone-800/80 px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider text-stone-300">
                  <ShieldCheck className="h-3 w-3 text-[#D93829]" aria-hidden="true" /> MSOT staff
                </span>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse admin sidebar"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-800 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand admin sidebar"
            className="mx-auto mt-3 grid h-7 w-7 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-800 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <AdminNavigation collapsed={collapsed} />
        </div>
        <AdminAccount
          collapsed={collapsed}
          displayName={displayName}
          initials={initials}
          isSigningOut={isSigningOut}
          onSignOut={() => void handleSignOut()}
        />
      </aside>

      <div className={cn(
        'relative z-10 min-h-screen transition-[padding] duration-200 lg:pl-72',
        collapsed && 'lg:pl-24',
      )}>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-stone-800 bg-[#28201E]/95 px-4 backdrop-blur-sm lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open MSOT staff navigation"
                className="grid h-9 w-9 place-items-center rounded-lg border border-stone-800 bg-stone-900 text-stone-300 hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-stone-800 bg-[#28201E] p-0 text-stone-200">
              <div className="flex h-full flex-col">
                <SheetHeader className="border-b border-stone-800 p-4 text-left">
                  <SheetTitle className="flex items-center gap-3 text-stone-100">
                    <HireableLogo size={28} />
                    <span>
                      <span className="block font-[var(--font-display)] font-bold">Hireable</span>
                      <span className="font-mono text-xs uppercase tracking-wider text-stone-400">MSOT staff</span>
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-3">
                  <AdminNavigation onNavigate={() => setMobileOpen(false)} />
                </div>
                <AdminAccount
                  displayName={displayName}
                  initials={initials}
                  isSigningOut={isSigningOut}
                  onSignOut={() => void handleSignOut()}
                />
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/admin-dashboard" className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]">
            <HireableLogo size={24} />
            <span className="text-sm font-semibold text-stone-200">MSOT command center</span>
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-stone-700 bg-stone-800 font-mono text-xs font-semibold text-stone-200">
            {initials}
          </span>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
