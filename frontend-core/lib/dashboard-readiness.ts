import type { ReadinessBreakdownItem, ReadinessScore } from '@/types';

export type RoadmapCategory =
  | 'resume'
  | 'projects'
  | 'mock_interview'
  | 'github'
  | 'linkedin'
  | 'co_curricular';
export type RoadmapStatus = 'Evidence needed' | 'Action required' | 'In progress' | 'Ready';

export interface DashboardRoadmapNode {
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
  { key: 'projects', label: 'Projects' },
  { key: 'mock_interview', label: 'Mock interview' },
  { key: 'github', label: 'GitHub' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'co_curricular', label: 'Co-curricular' },
];

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

interface RecommendationDefinition {
  title: string;
  description: (score: number) => string;
  href: string;
}

const ROADMAP_DEFINITIONS: readonly RoadmapDefinition[] = [
  { category: 'resume', stepNumber: 1, title: 'Resume', eyebrow: 'Document intelligence', maxPoints: 25, actionLabel: 'Improve resume', actionHref: '/dashboard/profile', side: 'left' },
  { category: 'projects', stepNumber: 2, title: 'Projects', eyebrow: 'Proof of work', maxPoints: 25, actionLabel: 'Manage projects', actionHref: '/dashboard/profile', side: 'right' },
  { category: 'mock_interview', stepNumber: 3, title: 'Mock Interview', eyebrow: '15-minute AI viva', maxPoints: 20, actionLabel: 'Launch interview', actionHref: '/interview/configure', side: 'left' },
  { category: 'github', stepNumber: 4, title: 'GitHub', eyebrow: 'Engineering evidence', maxPoints: 10, actionLabel: 'Review GitHub score', actionHref: '/dashboard#readiness-breakdown', side: 'right' },
  { category: 'linkedin', stepNumber: 5, title: 'LinkedIn', eyebrow: 'Recruiter presence', maxPoints: 10, actionLabel: 'Update profile', actionHref: '/dashboard/profile', side: 'left' },
  { category: 'co_curricular', stepNumber: 6, title: 'Co-curricular', eyebrow: 'Initiative and leadership', maxPoints: 10, actionLabel: 'Add achievements', actionHref: '/dashboard/profile', side: 'right' },
];

const RECOMMENDATION_DEFINITIONS: Record<RoadmapCategory, RecommendationDefinition> = {
  resume: {
    title: 'Strengthen your resume evidence',
    description: (score) => `Your resume score is ${score}/100. Add quantified outcomes and role-specific keywords to your strongest bullets.`,
    href: '/dashboard/profile',
  },
  projects: {
    title: 'Make your projects verifiable',
    description: (score) => `Your projects score is ${score}/100. Add a live link, test instructions, and measurable outcomes to your strongest project.`,
    href: '/dashboard/profile',
  },
  mock_interview: {
    title: 'Practice your interview delivery',
    description: (score) => `Your mock interview score is ${score}/100. Complete a focused AI viva and act on its weakest-topic feedback.`,
    href: '/interview/configure',
  },
  github: {
    title: 'Showcase your best GitHub work',
    description: (score) => `Your GitHub score is ${score}/100. Pin 2 representative repositories and add outcome-focused READMEs.`,
    href: '/dashboard/profile',
  },
  linkedin: {
    title: 'Align your LinkedIn profile',
    description: (score) => `Your LinkedIn score is ${score}/100. Add a role-specific headline, relevant skills, and evidence-backed project details.`,
    href: '/dashboard/profile',
  },
  co_curricular: {
    title: 'Document achievements beyond coursework',
    description: (score) => `Your co-curricular score is ${score}/100. Add verified certifications, hackathons, or leadership experience.`,
    href: '/dashboard/profile',
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
    const item = readiness?.breakdown?.[definition.category];
    return {
      ...definition,
      weightedPoints: clamp(item?.weightedPoints ?? 0, 0, definition.maxPoints),
      rawScore: scoreFor(item),
      status: statusFor(item),
    };
  });
}

export function buildNextBestActions(readiness: ReadinessScore | null): DashboardRecommendation[] {
  if (!readiness) return [];

  return ROADMAP_DEFINITIONS
    .map(({ category }) => ({ category, score: scoreFor(readiness.breakdown?.[category]) }))
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
  if (score >= 80) return 'Placement ready';
  if (score >= 60) return 'Nearly ready';
  return 'Building readiness';
}
