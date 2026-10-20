import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getOptionalAutomationBaseUrl,
  getProfileReviewBaseUrl,
} from '@/lib/backend-services';
import { calculateReadinessLocally } from '@/lib/readiness-calculator';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('backend service URL resolution', () => {
  it('supports the workspace profile engine variable and removes a health suffix', () => {
    vi.stubEnv('PROFILE_REVIEW_API_URL', '');
    vi.stubEnv('PROFILE_ENGINE_URL', 'http://127.0.0.1:8001/health');

    expect(getProfileReviewBaseUrl()).toBe('http://127.0.0.1:8001');
  });

  it('treats automation as optional for profile score aggregation', () => {
    vi.stubEnv('AUTOMATION_API_URL', '');
    vi.stubEnv('AUTOMATION_SERVICE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_AUTOMATION_URL', '');

    expect(getOptionalAutomationBaseUrl()).toBeNull();
  });
});

describe('local readiness calculation fallback', () => {
  it('matches the canonical seven-category weighting contract', () => {
    const result = calculateReadinessLocally({
      student_id: 'student-1',
      resume: { score: 80 },
      projects: [{ live_link_score: 90, code_quality_score: 80, documentation_score: 70 }],
      interview_session_result: { contract_version: 'v0', interview_score: 85 },
      github: { score: 75 },
      coding_practice: { score: 75 },
      linkedin: { score: 90 },
      co_curricular: { score: 60 },
    });

    expect(result.total_score).toBe(80);
    expect(result.category_scores.projects.raw_score).toBe(82);
    expect(result.category_scores).toMatchObject({
      resume: { weighted_points: 20, present: true },
      projects: { weighted_points: 20.5, present: true },
      mock_interview: { weighted_points: 17, present: true },
      github: { weighted_points: 7.5, present: true },
      coding_practice: { weighted_points: 7.5, present: true },
      linkedin: { weighted_points: 4.5, present: true },
      co_curricular: { weighted_points: 3, present: true },
    });
    expect(result.is_provisional).toBe(false);
    expect(result.readiness_level).toBe('Placement ready');
  });

  it('keeps missing evidence explicit instead of inventing scores', () => {
    const result = calculateReadinessLocally({
      student_id: 'student-2',
      resume: { score: 88 },
      projects: [],
      interview_session_result: null,
      github: { score: 72 },
      linkedin: null,
      co_curricular: null,
    });

    expect(result.missing_components).toEqual(['projects', 'mock_interview', 'coding_practice', 'linkedin', 'co_curricular']);
    expect(result.category_scores.mock_interview).toMatchObject({ raw_score: 0, present: false });
    expect(result.is_provisional).toBe(true);
  });
});
