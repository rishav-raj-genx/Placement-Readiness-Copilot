import { describe, expect, it } from 'vitest';
import {
  READINESS_CATEGORY_LABELS,
  buildDashboardRoadmap,
  buildNextBestActions,
  readinessTier,
} from '@/lib/dashboard-readiness';
import type { ReadinessScore } from '@/types';

const readiness: ReadinessScore = {
  totalScore: 63,
  readinessLevel: 'Nearly ready',
  topActions: [],
  breakdown: {
    resume: { rawScore: 80, weight: 0.25, weightedPoints: 20, present: true },
    projects: { rawScore: 48, weight: 0.25, weightedPoints: 12, present: true },
    mock_interview: { rawScore: 72, weight: 0.2, weightedPoints: 14.4, present: true },
    github: { rawScore: 0, weight: 0.1, weightedPoints: 0, present: false },
    linkedin: { rawScore: 45, weight: 0.1, weightedPoints: 4.5, present: true },
    co_curricular: { rawScore: 75, weight: 0.1, weightedPoints: 7.5, present: true },
  },
};

describe('dashboard readiness roadmap', () => {
  it('uses all six categories and the backend weighting contract', () => {
    const nodes = buildDashboardRoadmap(readiness);

    expect(nodes.map((node) => node.category)).toEqual([
      'resume',
      'projects',
      'mock_interview',
      'github',
      'linkedin',
      'co_curricular',
    ]);
    expect(nodes.map((node) => node.maxPoints)).toEqual([25, 25, 20, 10, 10, 10]);
    expect(READINESS_CATEGORY_LABELS.map(({ key }) => key)).toEqual(nodes.map(({ category }) => category));
    expect(nodes[3]?.actionHref).toBe('/dashboard#readiness-breakdown');
  });

  it('keeps every timeline node synchronized with its fetched category score', () => {
    const nodes = buildDashboardRoadmap(readiness);

    expect(nodes.map((node) => node.rawScore)).toEqual([80, 48, 72, 0, 45, 75]);
    expect(nodes[3]).toMatchObject({ category: 'github', weightedPoints: 0, rawScore: 0, status: 'Evidence needed' });
    expect(nodes[0]).toMatchObject({ weightedPoints: 20, status: 'Ready' });
    expect(nodes[1]).toMatchObject({ weightedPoints: 12, status: 'Action required' });
  });

  it('creates two actionable recommendations from the lowest scores', () => {
    const actions = buildNextBestActions(readiness);

    expect(actions.map((action) => action.category)).toEqual(['github', 'linkedin']);
    expect(actions[0]).toMatchObject({ score: 0, href: '/dashboard/profile' });
    expect(actions[0]?.description).toContain('Pin 2 representative repositories');
    expect(actions[1]?.description).toContain('45/100');
  });

  it('handles the pre-fetch state without fabricating recommendations', () => {
    expect(buildNextBestActions(null)).toEqual([]);
    expect(readinessTier(undefined)).toBe('Building readiness');
    expect(readinessTier(82)).toBe('Placement ready');
    expect(readinessTier(63, 'Backend tier')).toBe('Backend tier');
  });
});
