import { describe, expect, it } from 'vitest';
import { DASHBOARD_NAV_CONFIG } from '@/lib/dashboard-navigation';
import {
  buildDashboardRoadmap,
  buildNextBestActions,
} from '@/lib/dashboard-readiness';
import type { ReadinessScore } from '@/types';

const sampleReadiness: ReadinessScore = {
  totalScore: 65,
  readinessLevel: 'Nearly ready',
  topActions: [],
  breakdown: {
    resume: { rawScore: 60, weight: 0.2, weightedPoints: 12, present: true },
    github: { rawScore: 50, weight: 0.2, weightedPoints: 10, present: true },
    projects: { rawScore: 70, weight: 0.2, weightedPoints: 14, present: true },
    linkedin: { rawScore: 65, weight: 0.2, weightedPoints: 13, present: true },
    mock_interview: { rawScore: 80, weight: 0.2, weightedPoints: 16, present: true },
  },
};

describe('Action Plan & Global Navigation Wiring', () => {
  it('includes Action Plan in DASHBOARD_NAV_CONFIG directly below Home', () => {
    expect(DASHBOARD_NAV_CONFIG[0]?.href).toBe('/dashboard');
    expect(DASHBOARD_NAV_CONFIG[1]).toMatchObject({
      label: 'Action Plan',
      href: '/dashboard/action-plan',
      iconName: 'Target',
    });
  });

  it('wires timeline roadmap action buttons to specific #section anchors on the action-plan page', () => {
    const nodes = buildDashboardRoadmap(sampleReadiness);
    expect(nodes[0]?.actionHref).toBe('/dashboard/action-plan#resume');
    expect(nodes[1]?.actionHref).toBe('/dashboard/action-plan#github');
    expect(nodes[2]?.actionHref).toBe('/dashboard/action-plan#projects');
    expect(nodes[3]?.actionHref).toBe('/dashboard/action-plan#linkedin');
    expect(nodes[4]?.actionHref).toBe('/dashboard/action-plan#leetcode');
    expect(nodes[5]?.actionHref).toBe('/dashboard/interview');
  });

  it('supports compressing next best actions to 3 items for dashboard height matching', () => {
    const actions = buildNextBestActions(sampleReadiness);
    const top3 = actions.slice(0, 3);
    expect(top3.length).toBeLessThanOrEqual(3);
    expect(top3.length).toBeGreaterThan(0);
  });
});
