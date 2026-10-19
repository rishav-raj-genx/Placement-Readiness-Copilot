import { describe, expect, it } from 'vitest';
import { buildDashboardRoadmap, readinessTier } from '@/lib/dashboard-readiness';
import type { ReadinessScore } from '@/types';

const readiness: ReadinessScore = {
  totalScore: 63,
  readinessLevel: 'Nearly ready',
  topActions: [],
  breakdown: {
    resume: { rawScore: 80, weight: 0.25, weightedPoints: 20, present: true },
    github: { rawScore: 0, weight: 0.1, weightedPoints: 0, present: false },
    projects: { rawScore: 48, weight: 0.25, weightedPoints: 12, present: true },
    mock_interview: { rawScore: 72, weight: 0.2, weightedPoints: 14.4, present: true },
  },
};

describe('dashboard readiness roadmap', () => {
  it('uses the post-purge weighting contract', () => {
    expect(buildDashboardRoadmap(readiness).map((node) => node.maxPoints)).toEqual([25, 10, 25, 20]);
  });

  it('preserves missing evidence as not assessed', () => {
    const nodes = buildDashboardRoadmap(readiness);
    expect(nodes[1]).toMatchObject({ category: 'github', weightedPoints: null, rawScore: null, status: 'Not assessed' });
    expect(nodes[0]).toMatchObject({ weightedPoints: 20, status: 'Ready' });
    expect(nodes[2]).toMatchObject({ weightedPoints: 12, status: 'Action required' });
  });

  it('derives a fallback readiness tier without inventing a score', () => {
    expect(readinessTier(undefined)).toBe('Not assessed');
    expect(readinessTier(82)).toBe('Placement ready');
    expect(readinessTier(63, 'Backend tier')).toBe('Backend tier');
  });
});
