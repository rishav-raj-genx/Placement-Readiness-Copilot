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
    <nav aria-label="MSOT staff navigation" className="flex flex-col gap-4">
      {ADMIN_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            aria-current={active ? 'page' : undefined}
            className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <motion.div
              whileHover={
                reduceMotion
                  ? undefined
                  : {
                      scale: 1.15,
                      x: 12,
                      backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    }
              }
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 15,
              }}
              style={{ originX: 0 }}
              className={cn(
                'flex items-center rounded-xl py-3 text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-2' : 'gap-3 px-4',
                active
                  ? 'border-l-4 border-orange-500 bg-gradient-to-r from-orange-500/10 to-transparent text-orange-500'
                  : 'text-stone-400 hover:text-stone-200'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0 transition-colors',
                  active ? 'text-orange-500' : 'text-stone-400 group-hover:text-stone-200'
                )}
                aria-hidden="true"
              />
              {!collapsed && <span className="truncate">{label}</span>}
            </motion.div>
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
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-orange-500/20 bg-orange-500/10 font-mono text-xs font-semibold text-orange-400">
          {initials}
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-stone-200">{displayName}</p>
            <p className="mt-0.5 font-mono text-xs uppercase tracking-wider text-orange-400">Administrator</p>
          </div>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut}
            aria-label="Sign out"
            title="Sign out"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-800 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="mx-auto mt-2 grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-800 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="relative min-h-screen overflow-x-hidden bg-[#0B0F17] text-stone-200">
      <aside className={cn(
        'fixed bottom-4 left-4 top-4 z-40 hidden h-[calc(100vh-2rem)] flex-col rounded-2xl border border-stone-800 bg-[#121826] shadow-lg shadow-black/50 transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[72px]' : 'w-64',
      )}>
        <div className="flex flex-col h-full">
          <div className={cn(
            'flex min-h-20 items-center border-b border-stone-800 px-4',
            collapsed ? 'justify-center' : 'justify-between gap-3',
          )}>
            <Link
              href="/admin-dashboard"
              className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              <HireableLogo size={32} priority />
              {!collapsed && (
                <div className="min-w-0">
                  <p className="font-[var(--font-display)] text-base font-bold tracking-tight text-stone-100">Hireable</p>
                  <span className="mt-0.5 inline-flex items-center gap-1 rounded border border-orange-500/20 bg-orange-500/10 px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider text-orange-400">
                    <ShieldCheck className="h-3 w-3 text-orange-400" aria-hidden="true" /> MSOT staff
                  </span>
                </div>
              )}
            </Link>
            {!collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse admin sidebar"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-800 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
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
              className="mx-auto mt-3 grid h-7 w-7 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-800 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          {/* Phase 1 & 3: De-cramp Links wrapped in flex-1 flex flex-col justify-center gap-4 */}
          <div className="flex-1 flex flex-col justify-center gap-4 overflow-y-auto px-3 py-4">
            <AdminNavigation collapsed={collapsed} />
          </div>

          <AdminAccount
            collapsed={collapsed}
            displayName={displayName}
            initials={initials}
            isSigningOut={isSigningOut}
            onSignOut={() => void handleSignOut()}
          />
        </div>
      </aside>

      <div className={cn(
        'relative z-10 min-h-screen transition-[padding] duration-200 lg:pl-72',
        collapsed && 'lg:pl-24',
      )}>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-stone-800 bg-[#0B0F17]/95 px-4 backdrop-blur-sm lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open MSOT staff navigation"
                className="grid h-9 w-9 place-items-center rounded-lg border border-stone-800 bg-stone-900 text-stone-300 hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-stone-800 bg-[#121826] p-0 text-stone-200">
              <div className="flex h-full flex-col">
                <SheetHeader className="border-b border-stone-800 p-4 text-left">
                  <SheetTitle className="flex items-center gap-3 text-stone-100">
                    <HireableLogo size={28} />
                    <span>
                      <span className="block font-[var(--font-display)] font-bold">Hireable</span>
                      <span className="font-mono text-xs uppercase tracking-wider text-orange-400">MSOT staff</span>
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 flex flex-col justify-center gap-4 overflow-y-auto p-3">
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

          <Link href="/admin-dashboard" className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
            <HireableLogo size={24} />
            <span className="text-sm font-semibold text-stone-200">MSOT command center</span>
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-orange-500/20 bg-orange-500/10 font-mono text-xs font-semibold text-orange-400">
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
