import { describe, expect, it } from 'vitest';
import { buildMsotJobApplicantView, collectApplicationStudentIds } from '@/lib/msot-jobs';

const officialJob = {
  id: 'msot-role-1',
  title: 'Graduate Engineer',
  company: 'MSOT Partner',
  location: 'Remote · India',
  url: 'https://partner.example/jobs/1',
  source: 'msot',
  description: 'An official graduate role.',
  required_skills: ['TypeScript'],
  matched_skills: [],
  relevance_score: 0,
  match_reason: 'Official MSOT opportunity.',
  is_remote: true,
  job_type: 'full_time',
  employment_type: 'full_time',
  publication_status: 'published',
  is_msot_post: true,
  posted_at: '2026-10-20T08:00:00.000Z',
};

describe('MSOT job applicant view', () => {
  it('joins application activity with the minimum candidate profile fields', () => {
    const applications = [{
      student_id: 'student-1',
      job_id: 'msot-role-1',
      status: 'applied',
      applied_at: '2026-10-20T09:00:00.000Z',
    }];
    const profiles = [{ id: 'student-1', display_name: 'Asha Rao', email: 'asha@example.com' }];

    expect(collectApplicationStudentIds(applications)).toEqual(['student-1']);
    expect(buildMsotJobApplicantView([officialJob], applications, profiles)[0].applicants).toEqual([{
      userId: 'student-1',
      displayName: 'Asha Rao',
      email: 'asha@example.com',
      status: 'applied',
      appliedAt: '2026-10-20T09:00:00.000Z',
    }]);
  });

  it('excludes non-official jobs from the staff applicant table', () => {
    const jobs = [officialJob, { ...officialJob, id: 'scraped-1', is_msot_post: false }];
    expect(buildMsotJobApplicantView(jobs, [], [])).toHaveLength(1);
  });
});
