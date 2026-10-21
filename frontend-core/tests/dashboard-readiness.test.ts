import { describe, expect, it } from 'vitest';
import {
  READINESS_CATEGORY_LABELS,
  buildDashboardRoadmap,
  buildNextBestActions,
  calculateMasterReadinessScore,
  readinessTier,
} from '@/lib/dashboard-readiness';
import type { ReadinessScore } from '@/types';

const readiness: ReadinessScore = {
  totalScore: 53,
  readinessLevel: 'Almost ready',
  topActions: [],
  breakdown: {
    resume: { rawScore: 80, weight: 0.25, weightedPoints: 20, present: true },
    github: { rawScore: 0, weight: 0.15, weightedPoints: 0, present: false },
    projects: { rawScore: 40, weight: 0.20, weightedPoints: 8, present: true },
    linkedin: { rawScore: 45, weight: 0.10, weightedPoints: 4.5, present: true },
    mock_interview: { rawScore: 72, weight: 0.20, weightedPoints: 14.4, present: true },
    leetcode: { rawScore: 60, weight: 0.10, weightedPoints: 6, present: true },
  },
};

describe('dashboard readiness roadmap', () => {
  it('strictly enforces the six-step sequence: Resume, GitHub, Projects, LinkedIn, LeetCode, Mock Interview', () => {
    const nodes = buildDashboardRoadmap(readiness);

    expect(nodes.map((node) => node.category)).toEqual([
      'resume',
      'github',
      'projects',
      'linkedin',
      'leetcode',
      'mock_interview',
    ]);
    expect(nodes.map((node) => node.id)).toEqual(['01', '02', '03', '04', '05', '06']);
    expect(nodes.map((node) => node.eyebrow)).toEqual([
      'Document Intelligence',
      'Engineering Evidence',
      'Proof of Work',
      'Professional Network',
      'DSA & Contest Performance',
      '15-Minute AI Viva',
    ]);
    expect(nodes.map((node) => node.maxPoints)).toEqual([25, 15, 20, 10, 10, 20]);
    expect(nodes.reduce((acc, curr) => acc + curr.maxPoints, 0)).toBe(100);
    expect(READINESS_CATEGORY_LABELS.map(({ key }) => key)).toEqual(nodes.map(({ category }) => category));
    expect(nodes[1]?.actionHref).toBe('/dashboard/action-plan#github');
    expect(nodes[4]?.actionHref).toBe('/dashboard/action-plan#leetcode');
    expect(nodes[5]?.actionHref).toBe('/dashboard/interview');
  });

  it('keeps every timeline node synchronized with its fetched category score even if zero or missing', () => {
    const nodes = buildDashboardRoadmap(readiness);

    expect(nodes.map((node) => node.rawScore)).toEqual([80, 0, 40, 45, 60, 72]);
    expect(nodes[0]).toMatchObject({ weightedPoints: 20, status: 'Ready' });
    expect(nodes[1]).toMatchObject({ category: 'github', weightedPoints: 0, rawScore: 0, status: 'Evidence needed' });
    expect(nodes[2]).toMatchObject({ weightedPoints: 8, status: 'Action required' });
    expect(nodes[4]).toMatchObject({ category: 'leetcode', weightedPoints: 6, rawScore: 60, status: 'In progress' });
    expect(nodes[5]).toMatchObject({ category: 'mock_interview', weightedPoints: 14.4, rawScore: 72 });
  });

  it('preserves all 6 steps in exact sequence when GitHub and LinkedIn are completely missing from data', () => {
    const partialReadiness: ReadinessScore = {
      totalScore: 24,
      readinessLevel: 'Not ready',
      topActions: [],
      breakdown: {
        resume: { rawScore: 80, weight: 0.25, weightedPoints: 20, present: true },
        projects: { rawScore: 40, weight: 0.20, weightedPoints: 8, present: true },
        // github, linkedin, leetcode, mock_interview completely missing
      },
    };
    const nodes = buildDashboardRoadmap(partialReadiness);

    expect(nodes).toHaveLength(6);
    expect(nodes.map((node) => node.id)).toEqual(['01', '02', '03', '04', '05', '06']);
    expect(nodes.map((node) => node.title)).toEqual([
      'Resume',
      'GitHub',
      'Projects',
      'LinkedIn',
      'LeetCode',
      'Mock Interview',
    ]);
    expect(nodes[1]).toMatchObject({
      id: '02',
      title: 'GitHub',
      eyebrow: 'Engineering Evidence',
      maxPoints: 15,
      rawScore: 0,
      weightedPoints: 0,
      status: 'Evidence needed',
    });
    expect(nodes[3]).toMatchObject({
      id: '04',
      title: 'LinkedIn',
      eyebrow: 'Professional Network',
      maxPoints: 10,
      rawScore: 0,
      weightedPoints: 0,
      status: 'Evidence needed',
    });
    expect(nodes[4]).toMatchObject({
      id: '05',
      title: 'LeetCode',
      eyebrow: 'DSA & Contest Performance',
      maxPoints: 10,
      rawScore: 0,
      weightedPoints: 0,
      status: 'Evidence needed',
    });
    expect(nodes[5]).toMatchObject({
      id: '06',
      title: 'Mock Interview',
      eyebrow: '15-Minute AI Viva',
      maxPoints: 20,
      rawScore: 0,
      weightedPoints: 0,
      status: 'Evidence needed',
    });
  });

  it('guarantees alternating sides across all 6 roadmap nodes with Mock Interview anchored as final 06', () => {
    const nodes = buildDashboardRoadmap(null);

    expect(nodes).toHaveLength(6);
    expect(nodes.map((n) => n.side)).toEqual(['left', 'right', 'left', 'right', 'left', 'right']);
    expect(nodes[4]).toMatchObject({
      id: '05',
      title: 'LeetCode',
      category: 'leetcode',
      maxPoints: 10,
      side: 'left',
    });
    expect(nodes[5]).toMatchObject({
      id: '06',
      title: 'Mock Interview',
      category: 'mock_interview',
      maxPoints: 20,
      side: 'right',
    });
  });

  it('strictly enforces the master readiness calculation and caps LeetCode contribution at 10 points', () => {
    // 1. Perfect 100 on everything:
    const perfectScore = calculateMasterReadinessScore({
      resume: 100,
      projects: 100,
      mock_interview: 100,
      github: 100,
      linkedin: 100,
      leetcode: 100,
    });
    // (100 * 0.25) + (100 * 0.20) + (100 * 0.20) + (100 * 0.15) + (100 * 0.10) + (100 * 0.10) = 100
    expect(perfectScore).toBe(100);

    // 2. LeetCode score over 100 is capped at 10 points
    const cappedScore = calculateMasterReadinessScore({
      resume: 80, // 20
      projects: 70, // 14
      mock_interview: 80, // 16
      github: 60, // 9
      linkedin: 50, // 5
      leetcode: 150, // capped at 10
    });
    // 20 + 14 + 16 + 9 + 5 + 10 = 74
    expect(cappedScore).toBe(74);

    // 3. Zero LeetCode defaults gracefully to 0 without failing
    const zeroLeetCode = calculateMasterReadinessScore({
      resume: 80, // 20
      projects: 80, // 16
      mock_interview: 80, // 16
      github: 80, // 12
      linkedin: 80, // 8
      leetcode: 0, // 0
    });
    // 20 + 16 + 16 + 12 + 8 + 0 = 72
    expect(zeroLeetCode).toBe(72);
  });

  it('creates actionable recommendations from the lowest scores, returning all 5 prioritized actions', () => {
    const actions = buildNextBestActions(readiness);

    expect(actions).toHaveLength(5);
    expect(actions.map((action) => action.category)).toEqual([
      'github',
      'projects',
      'linkedin',
      'leetcode',
      'mock_interview',
    ]);
    expect(actions[0]).toMatchObject({ score: 0, href: '/dashboard/profile' });
    expect(actions[0]?.description).toContain('15 pts max');
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
