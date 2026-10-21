import { describe, expect, it } from 'vitest';
import {
  READINESS_CATEGORY_LABELS,
  buildDashboardRoadmap,
  buildNextBestActions,
  readinessTier,
} from '@/lib/dashboard-readiness';
import type { ReadinessScore } from '@/types';

const readiness: ReadinessScore = {
  totalScore: 49,
  readinessLevel: 'Nearly ready',
  topActions: [],
  breakdown: {
    resume: { rawScore: 80, weight: 0.2, weightedPoints: 16, present: true },
    github: { rawScore: 0, weight: 0.2, weightedPoints: 0, present: false },
    projects: { rawScore: 40, weight: 0.2, weightedPoints: 8, present: true },
    linkedin: { rawScore: 45, weight: 0.2, weightedPoints: 9, present: true },
    mock_interview: { rawScore: 72, weight: 0.2, weightedPoints: 14.4, present: true },
  },
};

describe('dashboard readiness roadmap', () => {
  it('strictly enforces the five-step sequence: Resume, GitHub, Projects, LinkedIn, Mock Interview', () => {
    const nodes = buildDashboardRoadmap(readiness);

    expect(nodes.map((node) => node.category)).toEqual([
      'resume',
      'github',
      'projects',
      'linkedin',
      'mock_interview',
    ]);
    expect(nodes.map((node) => node.id)).toEqual(['01', '02', '03', '04', '05']);
    expect(nodes.map((node) => node.eyebrow)).toEqual([
      'Document Intelligence',
      'Engineering Evidence',
      'Proof of Work',
      'Professional Network',
      '15-Minute AI Viva',
    ]);
    expect(nodes.map((node) => node.maxPoints)).toEqual([20, 20, 20, 20, 20]);
    expect(READINESS_CATEGORY_LABELS.map(({ key }) => key)).toEqual(nodes.map(({ category }) => category));
    expect(nodes[1]?.actionHref).toBe('/dashboard#readiness-breakdown');
  });

  it('keeps every timeline node synchronized with its fetched category score even if zero or missing', () => {
    const nodes = buildDashboardRoadmap(readiness);

    expect(nodes.map((node) => node.rawScore)).toEqual([80, 0, 40, 45, 72]);
    expect(nodes[1]).toMatchObject({ category: 'github', weightedPoints: 0, rawScore: 0, status: 'Evidence needed' });
    expect(nodes[0]).toMatchObject({ weightedPoints: 16, status: 'Ready' });
    expect(nodes[2]).toMatchObject({ weightedPoints: 8, status: 'Action required' });
  });

  it('preserves all 5 steps in exact sequence when GitHub and LinkedIn are completely missing from data', () => {
    const partialReadiness: ReadinessScore = {
      totalScore: 24,
      readinessLevel: 'Not ready',
      topActions: [],
      breakdown: {
        resume: { rawScore: 80, weight: 0.2, weightedPoints: 16, present: true },
        projects: { rawScore: 40, weight: 0.2, weightedPoints: 8, present: true },
        // github, linkedin, mock_interview completely missing
      },
    };
    const nodes = buildDashboardRoadmap(partialReadiness);

    expect(nodes).toHaveLength(5);
    expect(nodes.map((node) => node.id)).toEqual(['01', '02', '03', '04', '05']);
    expect(nodes.map((node) => node.title)).toEqual([
      'Resume',
      'GitHub',
      'Projects',
      'LinkedIn',
      'Mock Interview',
    ]);
    expect(nodes[1]).toMatchObject({
      id: '02',
      title: 'GitHub',
      eyebrow: 'Engineering Evidence',
      maxPoints: 20,
      rawScore: 0,
      weightedPoints: 0,
      status: 'Evidence needed',
    });
    expect(nodes[3]).toMatchObject({
      id: '04',
      title: 'LinkedIn',
      eyebrow: 'Professional Network',
      maxPoints: 20,
      rawScore: 0,
      weightedPoints: 0,
      status: 'Evidence needed',
    });
  });

  it('guarantees Mock Interview is definitively anchored as the final node (05) at the bottom with alternating sides', () => {
    const nodes = buildDashboardRoadmap(null);

    expect(nodes).toHaveLength(5);
    expect(nodes.map((n) => n.side)).toEqual(['left', 'right', 'left', 'right', 'left']);
    const finalNode = nodes[4];
    expect(finalNode).toMatchObject({
      id: '05',
      title: 'Mock Interview',
      category: 'mock_interview',
      eyebrow: '15-Minute AI Viva',
      maxPoints: 20,
      rawScore: 0,
      weightedPoints: 0,
      status: 'Evidence needed',
      side: 'left',
    });
  });

  it('creates actionable recommendations from the lowest scores, returning all 5 prioritized actions', () => {
    const actions = buildNextBestActions(readiness);

    expect(actions).toHaveLength(5);
    expect(actions.map((action) => action.category)).toEqual([
      'github',
      'projects',
      'linkedin',
      'mock_interview',
      'resume',
    ]);
    expect(actions[0]).toMatchObject({ score: 0, href: '/dashboard/profile' });
    expect(actions[0]?.description).toContain('Pin 2 representative repositories');
    expect(actions[1]?.description).toContain('40/100');
  });

  it('handles the pre-fetch state without fabricating recommendations', () => {
    expect(buildNextBestActions(null)).toEqual([]);
    expect(readinessTier(undefined)).toBe('Building readiness');
    expect(readinessTier(82)).toBe('Placement ready');
    expect(readinessTier(63)).toBe('Almost ready');
    expect(readinessTier(63, 'Backend tier')).toBe('Backend tier');
  });
});
