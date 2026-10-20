import type { ReadinessBreakdownItem, ReadinessScore } from '@/types';

export type RoadmapCategory =
  | 'resume'
  | 'github'
  | 'projects'
  | 'linkedin'
  | 'mock_interview';

export type RoadmapStatus = 'Evidence needed' | 'Action required' | 'In progress' | 'Ready';

export interface DashboardRoadmapNode {
  id: string;
  category: RoadmapCategory;
  stepNumber: number;
  title: string;
  eyebrow: string;
  maxPoints: number;
  weightedPoints: number;
  rawScore: number;
  status: RoadmapStatus;
  actionLabel: string;
  actionHref: string;
  side: 'left' | 'right';
}

export interface DashboardRecommendation {
  category: RoadmapCategory;
  title: string;
  description: string;
  href: string;
  score: number;
}

export const READINESS_CATEGORY_LABELS: readonly { key: RoadmapCategory; label: string }[] = [
  { key: 'resume', label: 'Resume' },
  { key: 'github', label: 'GitHub' },
  { key: 'projects', label: 'Projects' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'mock_interview', label: 'Mock Interview' },
];

interface RoadmapDefinition {
  id: string;
  categoryKey: RoadmapCategory;
  stepNumber: number;
  title: string;
  eyebrow: string;
  maxPoints: number;
  actionLabel: string;
  actionHref: string;
  side: 'left' | 'right';
}

interface RecommendationDefinition {
  title: string;
  description: (score: number) => string;
  href: string;
}

const ROADMAP_DEFINITIONS: readonly RoadmapDefinition[] = [
  {
    id: '01',
    categoryKey: 'resume',
    stepNumber: 1,
    title: 'Resume',
    eyebrow: 'Document Intelligence',
    maxPoints: 20,
    actionLabel: 'Improve resume',
    actionHref: '/dashboard/profile',
    side: 'left',
  },
  {
    id: '02',
    categoryKey: 'github',
    stepNumber: 2,
    title: 'GitHub',
    eyebrow: 'Engineering Evidence',
    maxPoints: 20,
    actionLabel: 'Review GitHub score',
    actionHref: '/dashboard#readiness-breakdown',
    side: 'right',
  },
  {
    id: '03',
    categoryKey: 'projects',
    stepNumber: 3,
    title: 'Projects',
    eyebrow: 'Proof of Work',
    maxPoints: 20,
    actionLabel: 'Manage projects',
    actionHref: '/dashboard/profile',
    side: 'left',
  },
  {
    id: '04',
    categoryKey: 'linkedin',
    stepNumber: 4,
    title: 'LinkedIn',
    eyebrow: 'Professional Network',
    maxPoints: 20,
    actionLabel: 'Update profile',
    actionHref: '/dashboard/profile',
    side: 'right',
  },
  {
    id: '05',
    categoryKey: 'mock_interview',
    stepNumber: 5,
    title: 'Mock Interview',
    eyebrow: '15-Minute AI Viva',
    maxPoints: 20,
    actionLabel: 'Launch interview',
    actionHref: '/dashboard/interview',
    side: 'left',
  },
];

const RECOMMENDATION_DEFINITIONS: Record<RoadmapCategory, RecommendationDefinition> = {
  resume: {
    title: 'Strengthen your resume evidence',
    description: (score) => `Your resume score is ${score}/100. Add quantified outcomes and role-specific keywords to your strongest bullets.`,
    href: '/dashboard/profile',
  },
  github: {
    title: 'Showcase your best GitHub work',
    description: (score) => `Your GitHub score is ${score}/100. Pin 2 representative repositories and add outcome-focused READMEs.`,
    href: '/dashboard/profile',
  },
  projects: {
    title: 'Make your projects verifiable',
    description: (score) => `Your projects score is ${score}/100. Add a live link, test instructions, and measurable outcomes to your strongest project.`,
    href: '/dashboard/profile',
  },
  linkedin: {
    title: 'Align your LinkedIn profile',
    description: (score) => `Your LinkedIn score is ${score}/100. Add a role-specific headline, relevant skills, and evidence-backed project details.`,
    href: '/dashboard/profile',
  },
  mock_interview: {
    title: 'Practice your interview delivery',
    description: (score) => `Your mock interview score is ${score}/100. Complete a focused AI viva and act on its weakest-topic feedback.`,
    href: '/dashboard/interview',
  },
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function scoreFor(item: ReadinessBreakdownItem | undefined): number {
  return clamp(item?.rawScore ?? 0, 0, 100);
}

function statusFor(item: ReadinessBreakdownItem | undefined): RoadmapStatus {
  if (!item?.present) return 'Evidence needed';
  if (item.rawScore >= 80) return 'Ready';
  if (item.rawScore >= 60) return 'In progress';
  return 'Action required';
}

export function buildDashboardRoadmap(readiness: ReadinessScore | null): DashboardRoadmapNode[] {
  return ROADMAP_DEFINITIONS.map((definition) => {
    const item = readiness?.breakdown?.[definition.categoryKey];
    const rawScore = typeof item?.rawScore === 'number' && Number.isFinite(item.rawScore)
      ? clamp(item.rawScore, 0, 100)
      : 0;
    const weightedPoints = typeof item?.weightedPoints === 'number' && Number.isFinite(item.weightedPoints)
      ? clamp(item.weightedPoints, 0, definition.maxPoints)
      : Math.round(rawScore * (definition.maxPoints / 100) * 10) / 10;

    return {
      id: definition.id,
      category: definition.categoryKey,
      stepNumber: definition.stepNumber,
      title: definition.title,
      eyebrow: definition.eyebrow,
      maxPoints: definition.maxPoints,
      weightedPoints,
      rawScore,
      status: statusFor(item),
      actionLabel: definition.actionLabel,
      actionHref: definition.actionHref,
      side: definition.side,
    };
  });
}

export function buildNextBestActions(readiness: ReadinessScore | null): DashboardRecommendation[] {
  if (!readiness) return [];

  return ROADMAP_DEFINITIONS
    .map(({ categoryKey }) => ({ category: categoryKey, score: scoreFor(readiness.breakdown?.[categoryKey]) }))
    .sort((left, right) => left.score - right.score)
    .slice(0, 2)
    .map(({ category, score }) => {
      const recommendation = RECOMMENDATION_DEFINITIONS[category];
      return {
        category,
        title: recommendation.title,
        description: recommendation.description(Math.round(score)),
        href: recommendation.href,
        score: Math.round(score),
      };
    });
}

export function readinessTier(score: number | undefined, backendLevel?: string): string {
  if (backendLevel?.trim()) return backendLevel;
  if (typeof score !== 'number') return 'Building readiness';
  if (score >= 75) return 'Placement ready';
  if (score >= 50) return 'Almost ready';
  return 'Not ready';
}
