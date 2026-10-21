import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  MapPin,
  Radar,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { TrackedApplyLink } from '@/components/jobs/TrackedApplyLink';
import {
  DISCOVERED_JOB_COLUMNS,
  normalizeDiscoveredJobs,
  normalizeProfileSkills,
  personalizeAndRankDiscoveredJobs,
} from '@/lib/discovered-jobs';
import { createServerSessionClient } from '@/lib/supabase-session-server';
import { createSupabaseServiceClient } from '@/lib/supabase-service-server';
import { cn } from '@/lib/utils';
import type { DiscoveredJob } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CandidateMatchProfile {
  targetRole: string;
  skills: string[];
}

interface JobDiscoveryResult {
  profile: CandidateMatchProfile | null;
  jobs: DiscoveredJob[];
  error: string | null;
}

interface JobCardProps {
  job: DiscoveredJob;
}

const EMPLOYMENT_LABELS: Record<DiscoveredJob['employment_type'], string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  internship: 'Internship',
};

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
      jobsQuery = jobsQuery.or(`student_id.eq.${authData.user.id},is_msot_post.eq.true,student_id.is.null`);
    } else {
      jobsQuery = jobsQuery.or('is_msot_post.eq.true,student_id.is.null');
    }

    const { data: jobData, error: jobsError } = await jobsQuery
      .order('is_msot_post', { ascending: false })
      .order('relevance_score', { ascending: false })
      .order('posted_at', { ascending: false });

    if (jobsError) {
      console.warn('Jobs query warning:', jobsError.message);
      return {
        profile,
        jobs: [],
        error: jobsError.message,
      };
    }

    const jobsValue: unknown = jobData;
    return {
      profile,
      jobs: personalizeAndRankDiscoveredJobs(normalizeDiscoveredJobs(jobsValue), profile?.skills ?? []),
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

function clampScore(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)));
}

function normalizeSkill(value: string): string {
  return value.trim().toLowerCase();
}

function formatPostedAt(value: string): string {
  if (!value) return 'Recently added';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently added';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function matchBadgeClass(score: number): string {
  if (score >= 80) {
    return 'border-[#D93829]/30 bg-[#D93829]/10 text-stone-200';
  }
  if (score >= 60) {
    return 'border-stone-700 bg-stone-800 text-stone-300';
  }
  return 'border-stone-800 bg-stone-900 text-stone-400';
}

function JobCard({ job }: JobCardProps) {
  const matchScore = clampScore(job.relevance_score);
  const matchedSkills = new Set(job.matched_skills.map(normalizeSkill));
  const location = job.is_remote
    ? job.location ? `Remote · ${job.location}` : 'Remote'
    : job.location || 'Location not specified';

  return (
    <article className={cn(
      'flex min-h-[360px] flex-col rounded-2xl border bg-[#28201E] p-6 transition-colors',
      job.is_msot_post
        ? 'border-stone-700 hover:border-stone-600'
        : 'border-stone-800 hover:border-stone-700',
    )}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-stone-800 bg-stone-900 text-stone-300">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-100">{job.company}</p>
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-stone-500">
              {job.is_msot_post ? 'MSOT placement office' : job.source || 'Verified ATS'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {job.is_msot_post && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-900/40 bg-amber-950/30 px-2.5 py-1 text-[11px] font-medium text-amber-300">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> MSOT official
            </span>
          )}
          <span className="rounded-full border border-stone-800 bg-stone-900 px-2.5 py-1 text-[11px] font-medium text-stone-400">
            {EMPLOYMENT_LABELS[job.employment_type]}
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-mono font-medium ${matchBadgeClass(matchScore)}`}>
            {matchScore}% match
          </span>
        </div>
      </div>

      <div className="mt-5">
        <h2 className="text-xl font-bold leading-snug text-stone-100">{job.title}</h2>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-400">
          <span className="inline-flex items-center gap-1.5">
            {job.is_remote
              ? <Wifi className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
              : <MapPin className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />}
            {location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
            {formatPostedAt(job.posted_at)}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5" aria-label="Required skills">
        {job.required_skills.length > 0 ? job.required_skills.slice(0, 8).map((skill) => {
          const isMatched = matchedSkills.has(normalizeSkill(skill));
          return (
            <span
              key={skill}
              className={isMatched
                ? 'rounded-md border border-[#D93829]/30 bg-[#D93829]/10 px-2.5 py-1 text-[11px] font-medium text-stone-200'
                : 'rounded-md border border-stone-800 bg-stone-900/80 px-2.5 py-1 text-[11px] text-stone-400'}
            >
              {skill}
            </span>
          );
        }) : (
          <span className="text-xs text-stone-500">Skills supplied after opening the role</span>
        )}
      </div>

      <div className="mt-auto border-t border-stone-800/80 pt-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D93829]" aria-hidden="true" />
          <p className="line-clamp-2 text-xs leading-relaxed text-stone-400">
            {job.match_reason || 'Recommended from your target role, skills, and candidate profile.'}
          </p>
        </div>
        <TrackedApplyLink
          jobId={job.id}
          company={job.company}
          jobTitle={job.title}
          url={job.url}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#D93829] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
        >
          Apply now <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </TrackedApplyLink>
      </div>
    </article>
  );
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

      {jobs.length > 0 ? (
        <section className="mt-6" aria-labelledby="matches-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">Ranked by relevance</p>
              <h2 id="matches-heading" className="mt-0.5 text-lg font-bold text-stone-100">Best opportunities for you</h2>
            </div>
            <p className="font-mono text-xs text-stone-500">{jobs.length} published {jobs.length === 1 ? 'role' : 'roles'}</p>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            {jobs.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        </section>
      ) : (
        <section className="mt-6 rounded-2xl border border-dashed border-stone-800 bg-stone-900/30 px-6 py-16 text-center">
          <BriefcaseBusiness className="mx-auto h-8 w-8 text-stone-500" aria-hidden="true" />
          <h2 className="mt-3 text-base font-bold text-stone-200">No jobs available right now.</h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-stone-400">
            {error
              ? 'Job feeds are updating in the background. Please refresh in a moment.'
              : 'The discovery engine is scanning verified ATS feeds and official MSOT postings. New roles will appear here as they match your profile.'}
          </p>
        </section>
      )}
    </div>
  );
}
