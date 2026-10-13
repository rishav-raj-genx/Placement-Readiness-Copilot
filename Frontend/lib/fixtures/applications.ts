import type { JobApplication } from '@/types';

export const fixtureApplications: JobApplication[] = [
  {
    id: 'app-1',
    userId: 'demo-student',
    company: 'TechCorp',
    jobTitle: 'Frontend Developer',
    status: 'interviewing',
    applicationDate: '2026-09-28',
    notes: 'Recruiter reached out via LinkedIn. Technical interview scheduled for next week.',
    jobPostingUrl: 'https://example.com/apply/techcorp-frontend',
    createdAt: '2026-09-26T10:00:00Z',
  },
  {
    id: 'app-2',
    userId: 'demo-student',
    company: 'DataFlow Systems',
    jobTitle: 'Backend Engineer',
    status: 'applied',
    applicationDate: '2026-10-01',
    notes: 'Applied through company website. Awaiting response.',
    jobPostingUrl: 'https://example.com/apply/dataflow-backend',
    createdAt: '2026-10-01T14:00:00Z',
  },
  {
    id: 'app-3',
    userId: 'demo-student',
    company: 'StartupHub',
    jobTitle: 'Full Stack Developer',
    status: 'saved',
    applicationDate: '2026-10-05',
    notes: 'Interesting opportunity. Need to research the company more before applying.',
    jobPostingUrl: 'https://example.com/apply/starthub-fullstack',
    createdAt: '2026-10-05T09:00:00Z',
  },
];
