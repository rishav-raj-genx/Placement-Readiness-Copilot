import { describe, expect, it } from 'vitest';
import { calculateRemainingSeconds, getCountdownTone } from '@/lib/countdown';
import { findMatchingApplication } from '@/lib/applications';
import { isOfficialJob } from '@/lib/jobs';
import type { JobApplication, JobPosting } from '@/types';

const job: JobPosting = { id: 'j1', title: 'Engineer', company: 'MSOT', location: 'Remote', employmentType: 'full_time', description: 'Role', requiredSkills: [], status: 'published', createdAt: '', updatedAt: '', source: 'MSOT Admin' };
const application: JobApplication = { id: 'a1', userId: 'u1', jobId: 'j1', company: 'MSOT', jobTitle: 'Engineer', status: 'applied', applicationDate: '2026-10-19', createdAt: '2026-10-19' };

describe('interview and jobs helpers', () => {
  it('uses drift-resistant countdown thresholds', () => {
    const start = '2026-10-19T00:00:00.000Z';
    expect(calculateRemainingSeconds(start, 15, new Date(start).getTime() + 10 * 60_000)).toBe(300);
    expect(getCountdownTone(301)).toBe('green');
    expect(getCountdownTone(300)).toBe('yellow');
    expect(getCountdownTone(60)).toBe('red');
  });
  it('filters official jobs by exact source and finds idempotent logs', () => {
    expect(isOfficialJob(job)).toBe(true);
    expect(isOfficialJob({ ...job, source: 'MSOT Admin Partner' })).toBe(false);
    expect(findMatchingApplication([application], { userId: 'u1', jobId: 'j1', company: 'Else', jobTitle: 'Other' })?.id).toBe('a1');
  });
});
