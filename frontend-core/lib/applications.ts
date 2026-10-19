import type { JobApplication } from '@/types';

interface ApplicationIdentity {
  userId: string;
  jobId?: string;
  company: string;
  jobTitle: string;
}

export function findMatchingApplication(applications: JobApplication[], candidate: ApplicationIdentity): JobApplication | undefined {
  return applications.find((application) =>
    (candidate.jobId && application.jobId === candidate.jobId)
    || (application.userId === candidate.userId && application.company === candidate.company && application.jobTitle === candidate.jobTitle)
  );
}
