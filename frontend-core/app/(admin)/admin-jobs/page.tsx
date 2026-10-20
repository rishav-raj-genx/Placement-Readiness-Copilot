import { redirect } from 'next/navigation';
import { AdminJobsWorkspace } from '@/components/admin/AdminJobsWorkspace';
import { DISCOVERED_JOB_COLUMNS, normalizeDiscoveredJobs } from '@/lib/discovered-jobs';
import {
  buildMsotJobApplicantView,
  collectApplicationStudentIds,
  type MsotJobWithApplicants,
} from '@/lib/msot-jobs';
import { createServerSessionClient } from '@/lib/supabase-session-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface AdminJobData {
  jobs: MsotJobWithApplicants[];
  error: string | null;
}

function hasAdminRole(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const profile = value as Record<string, unknown>;
  return profile.role === 'admin';
}

async function loadAdminJobs(): Promise<AdminJobData> {
  const supabase = createServerSessionClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect('/auth?redirectTo=/admin-jobs');

  const { data: adminProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();
  const profileValue: unknown = adminProfile;
  if (profileError || !hasAdminRole(profileValue)) redirect('/dashboard');

  const { data: jobData, error: jobsError } = await supabase
    .from('discovered_jobs')
    .select(DISCOVERED_JOB_COLUMNS)
    .eq('is_msot_post', true)
    .eq('publication_status', 'published')
    .order('posted_at', { ascending: false });

  if (jobsError) return { jobs: [], error: 'Active MSOT jobs could not be loaded.' };
  const jobsValue: unknown = jobData;
  const jobIds = normalizeDiscoveredJobs(jobsValue).map((job) => job.id);
  if (jobIds.length === 0) return { jobs: [], error: null };

  const { data: applicationData, error: applicationsError } = await supabase
    .from('application_tracker')
    .select('student_id,job_id,status,applied_at,created_at')
    .in('job_id', jobIds)
    .order('applied_at', { ascending: false });

  if (applicationsError) {
    return {
      jobs: buildMsotJobApplicantView(jobsValue, [], []),
      error: 'Applicant activity could not be loaded.',
    };
  }

  const applicationsValue: unknown = applicationData;
  const studentIds = collectApplicationStudentIds(applicationsValue);
  if (studentIds.length === 0) {
    return { jobs: buildMsotJobApplicantView(jobsValue, applicationsValue, []), error: null };
  }

  const { data: profileData, error: applicantsError } = await supabase
    .from('profiles')
    .select('id,display_name,email')
    .in('id', studentIds);

  if (applicantsError) {
    return {
      jobs: buildMsotJobApplicantView(jobsValue, applicationsValue, []),
      error: 'Applicant identities could not be loaded.',
    };
  }

  const profilesValue: unknown = profileData;
  return {
    jobs: buildMsotJobApplicantView(jobsValue, applicationsValue, profilesValue),
    error: null,
  };
}

export default async function AdminJobsPage() {
  const { jobs, error } = await loadAdminJobs();
  return <AdminJobsWorkspace jobs={jobs} loadError={error} />;
}
