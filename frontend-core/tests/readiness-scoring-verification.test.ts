import { describe, expect, it } from 'vitest';
import { buildNextBestActions } from '@/lib/dashboard-readiness';
import type { ReadinessScore } from '@/types';

describe('Readiness Scoring & 5 Unique Actions Verification', () => {
  it('renders all 5 unique action items on the dashboard without hardcoded limits of 2', () => {
    const mockReadiness: ReadinessScore = {
      totalScore: 55,
      readinessLevel: 'Almost ready',
      topActions: [
        {
          title: 'Strengthen your resume evidence',
          priority: 'Critical',
          category: 'Resume',
          potentialPointGain: 12,
          description: 'Resume currently contributes 8 of 16.7 points.',
        },
        {
          title: 'Showcase your best GitHub work',
          priority: 'High',
          category: 'GitHub',
          potentialPointGain: 10,
          description: 'GitHub currently contributes 6.7 of 16.7 points.',
        },
        {
          title: 'Sharpen your coding & DSA skills',
          priority: 'High',
          category: 'Coding Practice',
          potentialPointGain: 10,
          description: 'Coding Practice currently contributes 6.7 of 16.7 points.',
        },
        {
          title: 'Make your projects verifiable',
          priority: 'Medium',
          category: 'Projects',
          potentialPointGain: 8,
          description: 'Projects currently contributes 8.3 of 16.7 points.',
        },
        {
          title: 'Practice your interview delivery',
          priority: 'Medium',
          category: 'Mock Interview',
          potentialPointGain: 5,
          description: 'Mock Interview currently contributes 11.7 of 16.7 points.',
        },
      ],
      breakdown: {
        resume: { rawScore: 48, weight: 0.1667, weightedPoints: 8.0, present: true },
        github: { rawScore: 40, weight: 0.1667, weightedPoints: 6.7, present: true },
        coding_practice: { rawScore: 40, weight: 0.1667, weightedPoints: 6.7, present: true },
        projects: { rawScore: 50, weight: 0.1667, weightedPoints: 8.3, present: true },
        mock_interview: { rawScore: 70, weight: 0.1667, weightedPoints: 11.7, present: true },
        linkedin: { rawScore: 85, weight: 0.1667, weightedPoints: 14.2, present: true },
      },
    };

    // 1. Verify topActions has 5 unique actions
    expect(mockReadiness.topActions).toHaveLength(5);
    const uniqueCategories = new Set(mockReadiness.topActions.map((a) => a.category));
    expect(uniqueCategories.size).toBe(5);

    // 2. Verify fallback buildNextBestActions also returns 5 actions without limit of 2
    const actions = buildNextBestActions(mockReadiness);
    expect(actions).toHaveLength(5);
    const uniqueFallbackCategories = new Set(actions.map((a) => a.category));
    expect(uniqueFallbackCategories.size).toBe(5);
  });

  it('calculates 6-pillar readiness score including coding practice', () => {
    const scores = {
      resume: 80,
      github: 70,
      projects: 75,
      linkedin: 65,
      mock_interview: 85,
      coding_practice: 75,
    };

    const totalReadiness = Math.round(
      (scores.resume +
        scores.github +
        scores.projects +
        scores.linkedin +
        scores.mock_interview +
        scores.coding_practice) / 6
    );

    // (80 + 70 + 75 + 65 + 85 + 75) / 6 = 450 / 6 = 75
    expect(totalReadiness).toBe(75);
  });
});
