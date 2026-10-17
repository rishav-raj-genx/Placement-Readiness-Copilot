'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Brain,
  History,
  Briefcase,
  FolderKanban,
  FileText,
  LogOut,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuthStore } from '@/stores/auth-store';
import { DemoBanner } from '@/components/shared/demo-banner';
import { toast } from 'sonner';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/interview/configure', label: 'AI Interview', icon: Brain, emphasized: true },
  { href: '/interview/history', label: 'Interview History', icon: History },
  { href: '/applications', label: 'Applications', icon: FolderKanban },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/resources', label: 'Resume & Resources', icon: FileText },
];

export function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const initials = user?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'ST';

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    router.push('/signin');
  };

  const isItemActive = (item: (typeof navItems)[0]) => {
    if (item.href === '/dashboard') {
      return pathname === '/dashboard';
    }
    if (item.href === '/interview/configure') {
      return pathname.startsWith('/interview') && !pathname.startsWith('/interview/history');
    }
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  const AccountFooter = ({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) => (
    <div className={cn('border-t border-border', collapsed ? 'p-2' : 'p-4')}>
      <div
        className={cn('mb-3 flex items-center gap-2', collapsed ? 'justify-center' : 'px-1')}
        title={user?.displayName || 'Student'}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-muted text-xs font-medium">{initials}</AvatarFallback>
        </Avatar>
        {!collapsed && (
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {user?.displayName || 'Student'}
          </span>
        )}
      </div>
      <Button
        variant="outline"
        size={collapsed ? 'icon' : 'default'}
        className={cn(
          'group border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors',
          collapsed ? 'h-9 w-9 mx-auto flex' : 'w-full justify-start'
        )}
        onClick={async () => {
          onNavigate?.();
          await handleSignOut();
        }}
        aria-label="Sign Out"
        title="Sign Out"
      >
        <LogOut className={cn('h-4 w-4 shrink-0 text-muted-foreground group-hover:text-destructive transition-colors', !collapsed && 'mr-2')} />
        {!collapsed && 'Sign Out'}
      </Button>
    </div>
  );

  const NavLinks = ({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) => (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = isItemActive(item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              'relative flex items-center rounded-md text-sm font-medium transition-colors',
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2',
              isActive
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
            {item.emphasized && (
              <span
                className={cn(
                  'rounded-full bg-brand shrink-0',
                  collapsed ? 'absolute top-1.5 right-1.5 h-1.5 w-1.5' : 'h-1.5 w-1.5'
                )}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Fixed Sidebar: stays stationary when the user scrolls */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card transition-[width] duration-300 ease-in-out md:flex',
          sidebarCollapsed ? 'w-[72px]' : 'w-60'
        )}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-border px-3">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className={cn(
              'group flex w-full items-center rounded-xl p-2 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              sidebarCollapsed ? 'justify-center' : 'justify-start'
            )}
            aria-label={sidebarCollapsed ? 'Expand navigation bar' : 'Close navigation bar'}
            title={sidebarCollapsed ? 'Expand navigation bar' : 'Close navigation bar'}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 transition-colors group-hover:bg-brand/20">
                <Brain className="h-4.5 w-4.5 text-brand" />
              </div>
              {!sidebarCollapsed && (
                <span className="text-base font-semibold tracking-tight text-foreground whitespace-nowrap">
                  MSOT
                </span>
              )}
            </div>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks collapsed={sidebarCollapsed} />
        </div>
        <AccountFooter collapsed={sidebarCollapsed} />
      </aside>

      {/* Main Content Area */}
      <div
        className={cn(
          'flex min-h-screen min-w-0 flex-1 flex-col transition-[padding] duration-300 ease-in-out',
          sidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-60'
        )}
      >
        {/* Mobile Header: sticky top so it never scrolls away */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex h-full flex-col">
                <SheetHeader className="border-b border-border px-6 py-4 text-left">
                  <SheetTitle className="flex items-center gap-2 text-base font-semibold">
                    <Brain className="h-6 w-6 text-brand" />
                    MSOT
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-4">
                  <NavLinks onNavigate={() => setMobileOpen(false)} />
                </div>
                <AccountFooter onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/dashboard" className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-brand" />
            <span className="font-semibold text-foreground">MSOT</span>
          </Link>
          <div className="w-9" />
        </header>

        <DemoBanner />

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
