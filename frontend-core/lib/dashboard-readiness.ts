import type { ReadinessBreakdownItem, ReadinessScore } from '@/types';

export type RoadmapCategory = 'resume' | 'github' | 'projects' | 'mock_interview';
export type RoadmapStatus = 'Not assessed' | 'Action required' | 'In progress' | 'Ready';

export interface DashboardRoadmapNode {
  category: RoadmapCategory;
  stepNumber: number;
  title: string;
  eyebrow: string;
  maxPoints: number;
  weightedPoints: number | null;
  rawScore: number | null;
  status: RoadmapStatus;
  actionLabel: string;
  actionHref: string;
  side: 'left' | 'right';
}

interface RoadmapDefinition {
  category: RoadmapCategory;
  stepNumber: number;
  title: string;
  eyebrow: string;
  maxPoints: number;
  actionLabel: string;
  actionHref: string;
  side: 'left' | 'right';
}

const ROADMAP_DEFINITIONS: readonly RoadmapDefinition[] = [
  { category: 'resume', stepNumber: 1, title: 'Profile & Resume', eyebrow: 'Document intelligence', maxPoints: 25, actionLabel: 'Review profile', actionHref: '/dashboard/profile', side: 'left' },
  { category: 'github', stepNumber: 2, title: 'GitHub Check', eyebrow: 'Engineering evidence', maxPoints: 10, actionLabel: 'Open review', actionHref: '/review', side: 'right' },
  { category: 'projects', stepNumber: 3, title: 'Projects', eyebrow: 'Proof of work', maxPoints: 25, actionLabel: 'Manage projects', actionHref: '/dashboard/profile', side: 'left' },
  { category: 'mock_interview', stepNumber: 4, title: 'Mock Interview', eyebrow: '15-minute AI viva', maxPoints: 20, actionLabel: 'Launch interview', actionHref: '/interview/configure', side: 'right' },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function statusFor(item: ReadinessBreakdownItem | undefined): RoadmapStatus {
  if (!item?.present) return 'Not assessed';
  if (item.rawScore >= 80) return 'Ready';
  if (item.rawScore >= 60) return 'In progress';
  return 'Action required';
}

export function buildDashboardRoadmap(readiness: ReadinessScore | null): DashboardRoadmapNode[] {
  return ROADMAP_DEFINITIONS.map((definition) => {
    const item = readiness?.breakdown?.[definition.category];
    const present = item?.present === true;
    return {
      ...definition,
      weightedPoints: present ? clamp(item.weightedPoints, 0, definition.maxPoints) : null,
      rawScore: present ? clamp(item.rawScore, 0, 100) : null,
      status: statusFor(item),
    };
  });
}

export function readinessTier(score: number | undefined, backendLevel?: string): string {
  if (backendLevel?.trim()) return backendLevel;
  if (typeof score !== 'number') return 'Not assessed';
  if (score >= 80) return 'Placement ready';
  if (score >= 60) return 'Nearly ready';
  return 'Building readiness';
}
