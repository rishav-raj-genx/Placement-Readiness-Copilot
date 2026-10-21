export interface DashboardNavItemConfig {
  label: string;
  href: string;
  iconName: 'Home' | 'Target' | 'BriefcaseBusiness' | 'BarChart3' | 'Mic2' | 'History';
}

export const DASHBOARD_NAV_CONFIG: readonly DashboardNavItemConfig[] = [
  { label: 'Home', href: '/dashboard', iconName: 'Home' },
  { label: 'Action Plan', href: '/dashboard/action-plan', iconName: 'Target' },
  { label: 'Job Matches', href: '/dashboard/jobs', iconName: 'BriefcaseBusiness' },
  { label: 'Applications', href: '/dashboard/tracker', iconName: 'BarChart3' },
  { label: 'Interview', href: '/dashboard/interview', iconName: 'Mic2' },
  { label: 'Interview History', href: '/dashboard/interviews', iconName: 'History' },
] as const;
