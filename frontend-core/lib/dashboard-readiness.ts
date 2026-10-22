import type { ReadinessBreakdownItem, ReadinessScore } from '@/types';

export type RoadmapCategory =
  | 'resume'
  | 'projects'
  | 'mock_interview'
  | 'github'
  | 'linkedin'
  | 'leetcode'
  | 'coding_practice'
  | 'co_curricular';

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
  { key: 'leetcode', label: 'LeetCode' },
  { key: 'mock_interview', label: 'Mock Interview' },
];

export const ALL_READINESS_PILLARS: readonly { key: RoadmapCategory; label: string; maxPoints: number; weight: number }[] = [
  { key: 'resume', label: 'Resume', maxPoints: 25, weight: 0.25 },
  { key: 'projects', label: 'Projects', maxPoints: 25, weight: 0.25 },
  { key: 'mock_interview', label: 'Mock Interview', maxPoints: 20, weight: 0.20 },
  { key: 'github', label: 'GitHub', maxPoints: 10, weight: 0.10 },
  { key: 'coding_practice', label: 'Coding Practice', maxPoints: 10, weight: 0.10 },
  { key: 'linkedin', label: 'LinkedIn', maxPoints: 5, weight: 0.05 },
  { key: 'co_curricular', label: 'Co-curricular', maxPoints: 5, weight: 0.05 },
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

export const ROADMAP_DEFINITIONS: readonly RoadmapDefinition[] = [
  {
    id: '01',
    categoryKey: 'resume',
    stepNumber: 1,
    title: 'Resume',
    eyebrow: 'Document Intelligence',
    maxPoints: 25,
    actionLabel: 'Improve resume',
    actionHref: '/dashboard/action-plan#resume',
    side: 'left',
  },
  {
    id: '02',
    categoryKey: 'github',
    stepNumber: 2,
    title: 'GitHub',
    eyebrow: 'Engineering Evidence',
    maxPoints: 15,
    actionLabel: 'Review GitHub score',
    actionHref: '/dashboard/action-plan#github',
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
    actionHref: '/dashboard/action-plan#projects',
    side: 'left',
  },
  {
    id: '04',
    categoryKey: 'linkedin',
    stepNumber: 4,
    title: 'LinkedIn',
    eyebrow: 'Professional Network',
    maxPoints: 10,
    actionLabel: 'Update profile',
    actionHref: '/dashboard/action-plan#linkedin',
    side: 'right',
  },
  {
    id: '05',
    categoryKey: 'leetcode',
    stepNumber: 5,
    title: 'LeetCode',
    eyebrow: 'DSA & Contest Performance',
    maxPoints: 10,
    actionLabel: 'Coding practice',
    actionHref: '/dashboard/action-plan#leetcode',
    side: 'left',
  },
  {
    id: '06',
    categoryKey: 'mock_interview',
    stepNumber: 6,
    title: 'Mock Interview',
    eyebrow: '15-Minute AI Viva',
    maxPoints: 20,
    actionLabel: 'Launch interview',
    actionHref: '/dashboard/interview',
    side: 'right',
  },
];

const RECOMMENDATION_DEFINITIONS: Record<RoadmapCategory, RecommendationDefinition> = {
  resume: {
    title: 'Strengthen your resume evidence',
    description: (score) => `Your resume score is ${score}/100. Add quantified outcomes and role-specific keywords to your strongest bullets (25 pts max).`,
    href: '/dashboard/profile',
  },
  projects: {
    title: 'Make your projects verifiable',
    description: (score) => `Your projects score is ${score}/100. Add live links, clear README documentation, and measurable metrics (20 pts max).`,
    href: '/dashboard/profile',
  },
  mock_interview: {
    title: 'Practice your interview delivery',
    description: (score) => `Your mock interview score is ${score}/100. Complete a focused 15 or 20-min AI viva and review feedback (20 pts max).`,
    href: '/dashboard/interview',
  },
  github: {
    title: 'Showcase your best GitHub work',
    description: (score) => `Your GitHub score is ${score}/100. Pin representative repositories with CI/CD and clean code structure (15 pts max).`,
    href: '/dashboard/profile',
  },
  linkedin: {
    title: 'Align your LinkedIn profile',
    description: (score) => `Your LinkedIn score is ${score}/100. Add a role-focused headline, summary, and skills (10 pts max).`,
    href: '/dashboard/profile',
  },
  leetcode: {
    title: 'Sharpen your LeetCode DSA stats',
    description: (score) => `Your LeetCode score is ${score}/100. Aim for >300 solved problems with solid Medium/Hard ratio for full 10 points.`,
    href: '/dashboard/interview/coding',
  },
  coding_practice: {
    title: 'Sharpen your LeetCode DSA stats',
    description: (score) => `Your LeetCode score is ${score}/100. Aim for >300 solved problems with solid Medium/Hard ratio for full 10 points.`,
    href: '/dashboard/interview/coding',
  },
  co_curricular: {
    title: 'Showcase co-curricular achievements',
    description: (score) => `Your co-curricular score is ${score}/100. Add verified certifications, hackathons, or leadership achievements (5 pts max).`,
    href: '/dashboard/profile',
  },
};

export function calculateMasterReadinessScore(scores: {
  resume: number;
  projects: number;
  mock?: number;
  mock_interview?: number;
  github: number;
  linkedin: number;
  leetcode?: number;
  coding_practice?: number;
}): number {
  const resume = clamp(scores.resume, 0, 100);
  const projects = clamp(scores.projects, 0, 100);
  const mock = clamp(scores.mock_interview ?? scores.mock ?? 0, 0, 100);
  const github = clamp(scores.github, 0, 100);
  const linkedin = clamp(scores.linkedin, 0, 100);
  const leetcode = clamp(scores.leetcode ?? scores.coding_practice ?? 0, 0, 100);

  // Math explicitly caps LeetCode's contribution at 10 points
  const leetcodeContribution = Math.min(10, Math.max(0, leetcode * 0.10));

  const total =
    (resume * 0.25) +
    (projects * 0.20) +
    (mock * 0.20) +
    (github * 0.15) +
    (linkedin * 0.10) +
    leetcodeContribution;

  return Math.min(100, Math.max(0, Math.round(total)));
}

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
    const item =
      readiness?.breakdown?.[definition.categoryKey] ||
      (definition.categoryKey === 'leetcode' ? readiness?.breakdown?.['coding_practice'] : undefined) ||
      (definition.categoryKey === 'coding_practice' ? readiness?.breakdown?.['leetcode'] : undefined);
    const rawScore = typeof item?.rawScore === 'number' && Number.isFinite(item.rawScore)
      ? clamp(item.rawScore, 0, 100)
      : 0;
    let weightedPoints = typeof item?.weightedPoints === 'number' && Number.isFinite(item.weightedPoints)
      ? clamp(item.weightedPoints, 0, definition.maxPoints)
      : Math.round(rawScore * (definition.maxPoints / 100) * 10) / 10;

    if (definition.categoryKey === 'leetcode' || definition.categoryKey === 'coding_practice') {
      weightedPoints = Math.min(10, weightedPoints);
    }

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
    .slice(0, 5)
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
