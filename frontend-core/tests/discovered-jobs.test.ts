import { describe, expect, it } from 'vitest';
import { normalizeDiscoveredJob, normalizeDiscoveredJobs } from '@/lib/discovered-jobs';

const validJob = {
  id: 'greenhouse-123',
  title: 'Frontend Engineer',
  company: 'Example Labs',
  location: 'Bengaluru',
  url: 'https://boards.greenhouse.io/example/jobs/123',
  source: 'greenhouse',
  description: 'Build accessible product experiences.',
  required_skills: ['TypeScript', 'React'],
  matched_skills: ['typescript'],
  relevance_score: '87.50',
  match_reason: 'Strong TypeScript overlap.',
  is_remote: true,
  job_type: 'entry-level',
  employment_type: 'full_time',
  publication_status: 'published',
  posted_at: '2026-10-20T08:00:00.000Z',
};

describe('discovered job normalization', () => {
  it('maps a valid Supabase row to the strict frontend contract', () => {
    expect(normalizeDiscoveredJob(validJob)).toEqual({
      ...validJob,
      relevance_score: 87.5,
      url: 'https://boards.greenhouse.io/example/jobs/123',
    });
  });

  it('rejects unsafe external URLs and unsupported enum values', () => {
    expect(normalizeDiscoveredJob({ ...validJob, url: 'javascript:alert(1)' })).toBeNull();
    expect(normalizeDiscoveredJob({ ...validJob, employment_type: 'temporary' })).toBeNull();
  });

  it('drops malformed rows without discarding valid jobs', () => {
    expect(normalizeDiscoveredJobs([validJob, null, { title: 'Missing identifiers' }])).toHaveLength(1);
  });
});
