'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BarChart3,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  History,
  Home,
  LogIn,
  LogOut,
  Mic2,
  Settings,
} from 'lucide-react';
import { HireableLogo } from '@/components/brand/hireable-logo';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';

export const DASHBOARD_NAV_ITEMS = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Job Matches', href: '/dashboard/jobs', icon: BriefcaseBusiness },
  { label: 'Applications', href: '/dashboard/tracker', icon: BarChart3 },
  { label: 'Interview', href: '/dashboard/interview', icon: Mic2 },
  { label: 'Interview History', href: '/dashboard/interviews', icon: History },
] as const;

interface DashboardNavigationProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function DashboardNavigation({ collapsed = false, onNavigate }: DashboardNavigationProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <nav aria-label="Dashboard navigation" className="space-y-2">
      {DASHBOARD_NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex min-h-11 items-center rounded-2xl text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-cyan-300',
              collapsed ? 'justify-center px-2' : 'gap-3.5 px-4',
              active ? 'text-white' : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
            )}
          >
            {active && (
              <motion.span
                layoutId="dashboard-active-route"
                className="absolute inset-0 rounded-2xl border border-cyan-400/30 bg-gradient-to-r from-indigo-500/25 via-cyan-500/15 to-transparent shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 25 }}
              />
            )}
            <Icon
              className={cn(
                'relative z-10 h-5 w-5 shrink-0 transition-colors',
                active ? 'text-cyan-300' : 'text-white/40 group-hover:text-white'
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

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function DashboardSidebar({ collapsed, onToggle }: DashboardSidebarProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const readiness = useProfileStore((state) => state.readiness);
  const resetProfile = useProfileStore((state) => state.reset);
  const displayName = user?.displayName || 'Guest';
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'G';
  const score = user ? readiness?.totalScore ?? 0 : 0;
  const profileHref = user ? '/dashboard/profile' : '/auth?mode=signup';

  const handleSignOut = async () => {
    resetProfile();
    await signOut();
    router.replace('/signin');
    router.refresh();
  };

  return (
    <aside
      className={cn(
        'fixed bottom-4 left-4 top-4 z-40 hidden flex-col rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-[width] duration-300 lg:flex',
        collapsed ? 'w-[76px]' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          'flex h-20 items-center border-b border-white/10 px-4',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <HireableLogo size={36} withGlow priority />
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-[var(--font-display)] text-lg font-bold tracking-tight text-white">
                Hireable
              </p>
              <p className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-300">
                Copilot Studio
              </p>
            </div>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="grid h-8 w-8 place-items-center rounded-xl text-white/40 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand sidebar"
          className="mx-auto mt-3 grid h-8 w-8 place-items-center rounded-xl text-white/40 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <DashboardNavigation collapsed={collapsed} />
      </div>

      {/* Readiness Mini Indicator */}
      <div className="border-t border-white/10 p-3">
        <div
          className={cn(
            'rounded-2xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/15 via-cyan-500/5 to-transparent',
            collapsed ? 'p-2' : 'p-3.5'
          )}
        >
          {collapsed ? (
            <p className="text-center font-mono text-xs font-bold text-cyan-200">
              {score}%
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-mono uppercase tracking-wider text-white/50">Readiness Score</span>
                <span className="font-mono font-bold text-cyan-300">{score}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-cyan-400"
                  style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Component 1 Profile Strip at Absolute Bottom */}
      <div className="border-t border-white/10 p-3">
        <div
          className={cn(
            'flex items-center rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5 backdrop-blur-xl',
            collapsed ? 'justify-center' : 'justify-between gap-3'
          )}
        >
          <Link
            href={profileHref}
            title="View Profile Settings"
            className={cn(
              'flex min-w-0 items-center outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
              collapsed ? '' : 'flex-1 gap-2.5'
            )}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 font-mono text-xs font-bold text-white shadow-md shadow-indigo-500/30">
              {initials}
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-white">
                  {displayName}
                </span>
                <span className="block truncate text-[10px] text-white/40">
                  {user?.targetRole ?? 'Preview Mode'}
                </span>
              </span>
            )}
          </Link>

          {!collapsed && (
            <div className="flex items-center gap-1">
              <Link
                href={profileHref}
                aria-label="Settings"
                title={user ? 'Profile Settings' : 'Create account'}
                className="grid h-8 w-8 place-items-center rounded-xl text-white/40 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                {user ? <Settings className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
              </Link>
              {user && (
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  aria-label="Sign out"
                  title="Sign out"
                  className="grid h-8 w-8 place-items-center rounded-xl text-white/40 transition hover:bg-rose-500/15 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
