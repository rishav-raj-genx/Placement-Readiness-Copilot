import type { JobPosting } from '@/types';

export function isOfficialJob(job: JobPosting): boolean {
  return job.source === 'Hireable Admin' || job.source === 'MSOT Admin';
}
