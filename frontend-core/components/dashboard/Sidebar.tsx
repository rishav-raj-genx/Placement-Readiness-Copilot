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
    <nav aria-label="Dashboard navigation" className="flex flex-col gap-4">
      {DASHBOARD_NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
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
                'flex items-center rounded-xl py-3 text-sm font-medium transition-colors cursor-none',
                collapsed ? 'justify-center px-2' : 'gap-3 px-4',
                active
                  ? 'border-l-4 border-orange-500 bg-gradient-to-r from-orange-500/10 to-transparent text-orange-500'
                  : 'text-stone-400 hover:text-stone-200'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0 transition-colors',
                  active ? 'text-orange-500' : 'text-stone-500 group-hover:text-stone-200'
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
        'fixed bottom-4 left-4 top-4 z-40 hidden h-[calc(100vh-2rem)] flex-col rounded-2xl border border-stone-800 bg-stone-950 shadow-md shadow-black/40 transition-[width] duration-300 lg:flex',
        collapsed ? 'w-[76px]' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          'flex h-20 items-center border-b border-stone-800 px-4',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <HireableLogo size={36} withGlow priority />
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-stone-100">
                Hireable
              </p>
              <p className="truncate text-xs text-stone-500">
                Placement workspace
              </p>
            </div>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="grid h-8 w-8 place-items-center rounded-xl text-stone-500 transition hover:bg-stone-800 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
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
          className="mx-auto mt-3 grid h-8 w-8 place-items-center rounded-xl text-stone-500 transition hover:bg-stone-800 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Main Navigation - Vertically Centered */}
      <div className="flex-1 flex flex-col justify-center overflow-y-auto px-3 py-4">
        <DashboardNavigation collapsed={collapsed} />
      </div>

      {/* Bottom Widgets Container with gap-4 */}
      <div className="flex flex-col gap-4 border-t border-stone-800 p-3">
        {/* Readiness Mini Indicator */}
        <div
          className={cn(
            'rounded-xl border border-stone-800 bg-stone-900',
            collapsed ? 'p-2' : 'p-3.5'
          )}
        >
          {collapsed ? (
            <p className="text-center text-xs font-bold text-orange-500">
              {score}%
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-400">Readiness score</span>
                <span className="font-bold text-orange-500">{score}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-600 transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* User Profile Card */}
        <div
          className={cn(
            'flex items-center rounded-xl border border-stone-800 bg-stone-900 p-2.5',
            collapsed ? 'justify-center' : 'justify-between gap-3'
          )}
        >
          <Link
            href={profileHref}
            title="View Profile Settings"
            className={cn(
              'flex min-w-0 items-center outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
              collapsed ? '' : 'flex-1 gap-2.5'
            )}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-orange-500 to-red-600 text-xs font-bold text-white">
              {initials}
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-white">
                  {displayName}
                </span>
                <span className="block truncate text-xs text-stone-500">
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
                className="grid h-8 w-8 place-items-center rounded-xl text-stone-500 transition hover:bg-stone-800 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
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
