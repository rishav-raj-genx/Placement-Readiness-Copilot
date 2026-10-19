import { describe, expect, it } from 'vitest';
import { normalizeReadinessScore } from '@/lib/data-adapters';
import { scoreCoCurricular } from '@/lib/scoring';

describe('readiness scoring contracts', () => {
  it('caps deterministic co-curricular evidence', () => {
    expect(scoreCoCurricular({ hackathonsCount: 3, certificationsCount: 3, clubLeadership: true })).toBe(100);
    expect(scoreCoCurricular({ hackathonsCount: 30, certificationsCount: 30, clubLeadership: true })).toBe(100);
    expect(scoreCoCurricular({ hackathonsCount: 0, certificationsCount: 0, clubLeadership: false })).toBe(0);
  });
  it('reads nested breakdown values and present state', () => {
    const score = normalizeReadinessScore({ total_score: 71, readiness_level: 'Almost ready', category_scores: { resume: { raw_score: 80, weight: 0.25, weighted_points: 20, present: true }, linkedin: { raw_score: 0, weight: 0.1, weighted_points: 0, present: false } }, is_provisional: true, missing_components: ['linkedin'], top_actions: [] });
    expect(score?.breakdown.resume.rawScore).toBe(80);
    expect(score?.breakdown.resume.weightedPoints).toBe(20);
    expect(score?.breakdown.linkedin.present).toBe(false);
    expect(score?.missingComponents).toEqual(['linkedin']);
  });
});
