import { redirect } from 'next/navigation';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Clock3,
  MapPin,
  Radar,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { normalizeDiscoveredJobs, normalizeProfileSkills } from '@/lib/discovered-jobs';
import { createServerSessionClient } from '@/lib/supabase-session-server';
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
  authRequired: boolean;
}

interface JobCardProps {
  job: DiscoveredJob;
}

const EMPLOYMENT_LABELS: Record<DiscoveredJob['employment_type'], string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  internship: 'Internship',
};

const DISCOVERED_JOB_COLUMNS = [
  'id',
  'title',
  'company',
  'location',
  'url',
  'source',
  'description',
  'required_skills',
  'matched_skills',
  'relevance_score',
  'match_reason',
  'is_remote',
  'job_type',
  'employment_type',
  'publication_status',
  'posted_at',
].join(',');

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
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return { profile: null, jobs: [], error: null, authRequired: true };
    }

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
        authRequired: false,
      };
    }

    const profileValue: unknown = profileData;
    const profile: CandidateMatchProfile = {
      targetRole: readTargetRole(profileValue),
      skills: readProfileSkills(profileValue),
    };

    const { data: jobData, error: jobsError } = await supabase
      .from('discovered_jobs')
      .select(DISCOVERED_JOB_COLUMNS)
      .eq('publication_status', 'published')
      .order('relevance_score', { ascending: false })
      .order('posted_at', { ascending: false });

    if (jobsError) {
      return {
        profile,
        jobs: [],
        error: 'Published job matches could not be loaded.',
        authRequired: false,
      };
    }

    const jobsValue: unknown = jobData;
    return {
      profile,
      jobs: normalizeDiscoveredJobs(jobsValue),
      error: null,
      authRequired: false,
    };
  } catch {
    return {
      profile: null,
      jobs: [],
      error: 'Job discovery is temporarily unavailable.',
      authRequired: false,
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
    return 'border-cyan-300/35 bg-cyan-400/15 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.14)]';
  }
  if (score >= 60) {
    return 'border-indigo-300/35 bg-indigo-400/15 text-indigo-100 shadow-[0_0_24px_rgba(129,140,248,0.12)]';
  }
  return 'border-white/15 bg-white/[0.06] text-white/70';
}

function JobCard({ job }: JobCardProps) {
  const matchScore = clampScore(job.relevance_score);
  const matchedSkills = new Set(job.matched_skills.map(normalizeSkill));
  const location = job.is_remote
    ? job.location ? `Remote · ${job.location}` : 'Remote'
    : job.location || 'Location not specified';

  return (
    <article className="group relative flex min-h-[390px] flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#121D31]/90 via-[#0D1728]/90 to-[#0A1321]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-cyan-300/25 hover:shadow-[0_28px_80px_rgba(6,182,212,0.10)]">
      <div aria-hidden="true" className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl transition group-hover:bg-cyan-400/10" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-indigo-200">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{job.company}</p>
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
              {job.source || 'Verified ATS'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-white/65">
            {EMPLOYMENT_LABELS[job.employment_type]}
          </span>
          <span className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${matchBadgeClass(matchScore)}`}>
            Match: {matchScore}%
          </span>
        </div>
      </div>

      <div className="relative mt-6">
        <h2 className="font-[var(--font-display)] text-2xl font-bold leading-tight text-white">{job.title}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/50">
          <span className="inline-flex items-center gap-1.5">
            {job.is_remote
              ? <Wifi className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
              : <MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
            {location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {formatPostedAt(job.posted_at)}
          </span>
        </div>
      </div>

      <div className="relative mt-6 flex flex-wrap gap-2" aria-label="Required skills">
        {job.required_skills.length > 0 ? job.required_skills.slice(0, 8).map((skill) => {
          const isMatched = matchedSkills.has(normalizeSkill(skill));
          return (
            <span
              key={skill}
              className={isMatched
                ? 'rounded-lg border border-cyan-300/25 bg-gradient-to-r from-cyan-400/15 to-indigo-400/15 px-2.5 py-1 text-[11px] font-medium text-cyan-100'
                : 'rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[11px] text-white/45'}
            >
              {skill}
            </span>
          );
        }) : (
          <span className="text-xs text-white/35">Skills supplied after opening the role</span>
        )}
      </div>

      <div className="relative mt-auto border-t border-white/[0.07] pt-5">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" aria-hidden="true" />
          <p className="line-clamp-2 text-xs leading-relaxed text-white/50">
            {job.match_reason || 'Recommended from your target role, skills, and candidate profile.'}
          </p>
        </div>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-3 text-sm font-bold text-white shadow-[0_10px_30px_rgba(79,70,229,0.2)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1321]"
        >
          Apply Now <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

export default async function JobsPage() {
  const { profile, jobs, error, authRequired } = await loadJobDiscovery();
  if (authRequired) redirect('/auth?redirectTo=/dashboard/jobs');

  return (
    <div className="relative min-h-screen pb-24">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.14),transparent_38%),radial-gradient(circle_at_85%_10%,rgba(34,211,238,0.10),transparent_34%)]" />

      <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0E1728]/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-9">
        <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-cyan-200">
              <Radar className="h-3.5 w-3.5" aria-hidden="true" /> Live discovery feed
            </div>
            <h1 className="mt-5 font-[var(--font-display)] text-4xl font-black tracking-tight text-white sm:text-5xl">
              AI Job Matches
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55 sm:text-base">
              Sourced from verified ATS endpoints (Greenhouse, Lever) based on your candidate profile.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/15 px-5 py-4 lg:min-w-64">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Calibrated for</p>
            <p className="mt-1.5 font-semibold text-white">{profile?.targetRole || 'Your target role'}</p>
            <p className="mt-1 text-xs text-white/40">{profile?.skills.length ?? 0} profile skills considered</p>
          </div>
        </div>
      </header>

      {error ? (
        <section className="mt-8 rounded-3xl border border-rose-400/20 bg-rose-500/[0.08] p-8 text-center" role="alert">
          <BriefcaseBusiness className="mx-auto h-7 w-7 text-rose-200" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold text-white">Job matches are unavailable</h2>
          <p className="mt-2 text-sm text-rose-100/70">{error} Refresh the page to try again.</p>
        </section>
      ) : jobs.length > 0 ? (
        <section className="mt-8" aria-labelledby="matches-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-indigo-300">Ranked by relevance</p>
              <h2 id="matches-heading" className="mt-1 text-xl font-bold text-white">Best opportunities for you</h2>
            </div>
            <p className="text-xs text-white/40">{jobs.length} published {jobs.length === 1 ? 'role' : 'roles'}</p>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            {jobs.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        </section>
      ) : (
        <section className="mt-8 rounded-3xl border border-dashed border-white/10 bg-white/[0.025] px-6 py-16 text-center">
          <BriefcaseBusiness className="mx-auto h-9 w-9 text-white/25" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold text-white">No published matches yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/45">
            The discovery engine is scanning verified ATS feeds. New roles will appear here as they match your profile.
          </p>
        </section>
      )}
    </div>
  );
}
