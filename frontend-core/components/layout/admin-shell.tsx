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
  { href: '/admin-dashboard', label: 'Command Center', icon: Building2 },
  { href: '/admin-jobs', label: 'Post Jobs', icon: BriefcaseBusiness },
  { href: '/admin-interviews', label: 'Review Vivas', icon: Mic2 },
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
    <nav aria-label="MSOT staff navigation" className="space-y-2">
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
              'group relative flex min-h-12 items-center rounded-2xl text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-300',
              collapsed ? 'justify-center px-2' : 'gap-3.5 px-4',
              active ? 'text-white' : 'text-white/55 hover:bg-white/[0.06] hover:text-white',
            )}
          >
            {active && (
              <motion.span
                layoutId="admin-active-route"
                className="absolute inset-0 rounded-2xl border border-violet-300/30 bg-gradient-to-r from-violet-500/25 via-amber-400/10 to-transparent shadow-[0_0_24px_rgba(139,92,246,0.16)]"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 25 }}
              />
            )}
            <Icon
              className={cn(
                'relative z-10 h-[22px] w-[22px] shrink-0 transition-colors',
                active ? 'text-amber-300' : 'text-white/35 group-hover:text-violet-200',
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
    <div className="border-t border-white/10 p-3">
      <div className={cn(
        'flex items-center rounded-2xl border border-white/[0.08] bg-white/[0.035] p-2.5',
        collapsed ? 'justify-center' : 'gap-2.5',
      )}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-amber-400 font-mono text-xs font-black text-white shadow-[0_8px_24px_rgba(139,92,246,0.25)]">
          {initials}
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{displayName}</p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-200/65">Administrator</p>
          </div>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut}
            aria-label="Sign out"
            title="Sign out"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/40 transition hover:bg-rose-500/15 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSigningOut
              ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              : <LogOut className="h-5 w-5" aria-hidden="true" />}
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
          className="mx-auto mt-2 grid h-9 w-9 place-items-center rounded-xl text-white/40 transition hover:bg-rose-500/15 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSigningOut
            ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            : <LogOut className="h-5 w-5" aria-hidden="true" />}
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
    <div className="relative min-h-screen overflow-x-hidden bg-[#0B0F17] text-white">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_8%_4%,rgba(139,92,246,0.12),transparent_30%),radial-gradient(circle_at_92%_8%,rgba(251,191,36,0.07),transparent_26%)]" />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:48px_48px]" />

      <aside className={cn(
        'fixed bottom-4 left-4 top-4 z-40 hidden flex-col rounded-3xl border border-violet-300/15 bg-[#111522]/88 shadow-[0_28px_90px_rgba(0,0,0,0.62)] backdrop-blur-2xl transition-[width] duration-300 lg:flex',
        collapsed ? 'w-[76px]' : 'w-64',
      )}>
        <div className={cn(
          'flex min-h-24 items-center border-b border-white/10 px-4',
          collapsed ? 'justify-center' : 'justify-between gap-3',
        )}>
          <Link
            href="/admin-dashboard"
            className="flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <HireableLogo size={38} withGlow priority />
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-[var(--font-display)] text-lg font-black tracking-tight text-white">Hireable</p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-amber-200">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" /> MSOT Staff
                </span>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse admin sidebar"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white/35 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand admin sidebar"
            className="mx-auto mt-3 grid h-8 w-8 place-items-center rounded-xl text-white/35 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-5">
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
        'relative z-10 min-h-screen transition-[padding] duration-300 lg:pl-72',
        collapsed && 'lg:pl-[92px]',
      )}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#0B0F17]/88 px-4 backdrop-blur-xl lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open MSOT staff navigation"
                className="grid h-10 w-10 place-items-center rounded-xl border border-violet-300/20 bg-violet-400/10 text-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[19rem] border-violet-300/15 bg-[#0B0F17] p-0 text-white">
              <div className="flex h-full flex-col">
                <SheetHeader className="border-b border-white/10 p-5 text-left">
                  <SheetTitle className="flex items-center gap-3 text-white">
                    <HireableLogo size={32} withGlow />
                    <span>
                      <span className="block font-[var(--font-display)] font-black">Hireable</span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-amber-200">MSOT Staff</span>
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-4">
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

          <Link href="/admin-dashboard" className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
            <HireableLogo size={27} />
            <span className="text-sm font-bold">MSOT Command Center</span>
          </Link>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-amber-400 font-mono text-[10px] font-black">
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
