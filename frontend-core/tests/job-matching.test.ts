import { describe, expect, it } from 'vitest';
import { inferEmploymentType, matchesJobProfile } from '@/lib/job-matching';
import type { JobPosting } from '@/types';

const publishedFrontendInternship: JobPosting = {
  id: 'job-1',
  title: 'Frontend Engineer Intern',
  company: 'Hireable',
  location: 'Remote',
  employmentType: 'internship',
  description: 'Build accessible web interfaces.',
  requiredSkills: ['React', 'TypeScript'],
  status: 'published',
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
};

describe('job profile matching', () => {
  it('maps an explicit target-role employment preference', () => {
    expect(inferEmploymentType('Frontend Engineering Internship')).toBe('internship');
    expect(inferEmploymentType('Full-Stack Software Engineer')).toBeNull();
  });

  it('requires published status, role alignment, skill overlap, and employment alignment', () => {
    const profile = { targetRole: 'Frontend Engineering Internship', skills: ['React'] };
    expect(matchesJobProfile(publishedFrontendInternship, profile)).toBe(true);
    expect(matchesJobProfile({ ...publishedFrontendInternship, status: 'unpublished' }, profile)).toBe(false);
    expect(matchesJobProfile({ ...publishedFrontendInternship, employmentType: 'full_time' }, profile)).toBe(false);
    expect(matchesJobProfile({ ...publishedFrontendInternship, title: 'Backend Engineer', description: 'Python APIs', requiredSkills: ['Python'] }, profile)).toBe(false);
  });
});
