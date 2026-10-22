import { Radar } from 'lucide-react';
import {
  DISCOVERED_JOB_COLUMNS,
  filterDiscoveredJobsForTargetRole,
  normalizeDiscoveredJobs,
  normalizeProfileSkills,
  personalizeAndRankDiscoveredJobs,
} from '@/lib/discovered-jobs';
import { createServerSessionClient } from '@/lib/supabase-session-server';
import { createSupabaseServiceClient } from '@/lib/supabase-service-server';
import { JobsFeedClient, type CandidateMatchProfile } from '@/components/jobs/JobsFeedClient';
import type { DiscoveredJob } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface JobDiscoveryResult {
  profile: CandidateMatchProfile | null;
  jobs: DiscoveredJob[];
  error: string | null;
}

function readTargetRole(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  return typeof record.target_role === 'string' ? record.target_role.trim() : '';
}

function readProfileSkills(value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return normalizeProfileSkills(record.skills);
}

async function loadJobDiscovery(): Promise<JobDiscoveryResult> {
  try {
    const supabase = createServerSessionClient();
    const { data: authData } = await supabase.auth.getUser();
    let profile: CandidateMatchProfile | null = null;

    if (authData.user) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('target_role,skills')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        return {
          profile: null,
          jobs: [],
          error: 'Your candidate profile could not be loaded.',
        };
      }

      const profileValue: unknown = profileData;
      profile = {
        targetRole: readTargetRole(profileValue),
        skills: readProfileSkills(profileValue),
      };
    }

    // Guest reads stay server-side and are limited to published columns below;
    // the service-role credential is never included in the client bundle.
    const jobsClient = authData.user ? supabase : createSupabaseServiceClient();

    let jobsQuery = jobsClient
      .from('discovered_jobs')
      .select(DISCOVERED_JOB_COLUMNS)
      .eq('publication_status', 'published');

    if (authData.user) {
      // Crucial: Use the .or() filter to allow global admin jobs to bypass the student_id lock
      jobsQuery = jobsQuery.or(`student_id.eq.${authData.user.id},is_msot_post.eq.true`);
    } else {
      jobsQuery = jobsQuery.or('is_msot_post.eq.true');
    }

    const { data: jobData, error: jobsError } = await jobsQuery
      .order('is_msot_post', { ascending: false })
      .order('relevance_score', { ascending: false })
      .order('posted_at', { ascending: false });

    if (jobsError) {
      console.error("Job Fetch Error:", jobsError.message);
      return {
        profile,
        jobs: [],
        error: jobsError.message,
      };
    }

    const jobsValue: unknown = jobData;
    const normalizedJobs = normalizeDiscoveredJobs(jobsValue);
    const roleFilteredJobs = filterDiscoveredJobsForTargetRole(
      normalizedJobs,
      profile?.targetRole ?? '',
    );
    const effectiveJobs = roleFilteredJobs.length > 0 ? roleFilteredJobs : normalizedJobs;
    return {
      profile,
      jobs: personalizeAndRankDiscoveredJobs(effectiveJobs, profile?.skills ?? []),
      error: null,
    };
  } catch {
    return {
      profile: null,
      jobs: [],
      error: 'Job discovery is temporarily unavailable.',
    };
  }
}

export default async function JobsPage() {
  const { profile, jobs, error } = await loadJobDiscovery();

  return (
    <div className="relative min-h-screen pb-24">
      <header className="overflow-hidden rounded-2xl border border-stone-800 bg-[#28201E] p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-800 bg-stone-900 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-stone-400">
              <Radar className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" /> Live discovery feed
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-stone-100 sm:text-4xl">
              Job matches
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-400">
              Sourced from verified ATS endpoints based on your candidate profile.
            </p>
          </div>

          <div className="rounded-xl border border-stone-800 bg-stone-900/60 px-4 py-3 lg:min-w-56">
            <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">Calibrated for</p>
            <p className="mt-1 font-semibold text-stone-200">{profile?.targetRole || 'Your target role'}</p>
            <p className="mt-0.5 text-xs text-stone-400">{profile?.skills.length ?? 0} profile skills considered</p>
          </div>
        </div>
      </header>

      <JobsFeedClient
        profile={profile}
        initialJobs={jobs}
        initialError={error}
      />
    </div>
  );
}
