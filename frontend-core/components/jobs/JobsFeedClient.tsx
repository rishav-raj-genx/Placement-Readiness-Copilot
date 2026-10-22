'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { TrackedApplyLink } from '@/components/jobs/TrackedApplyLink';
import {
  filterDiscoveredJobsForTargetRole,
  normalizeDiscoveredJobs,
  personalizeAndRankDiscoveredJobs,
} from '@/lib/discovered-jobs';
import { cn } from '@/lib/utils';
import type { DiscoveredJob } from '@/types';

export interface CandidateMatchProfile {
  targetRole: string;
  skills: string[];
}

interface JobsFeedClientProps {
  profile: CandidateMatchProfile | null;
  initialJobs: DiscoveredJob[];
  initialError: string | null;
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

export function JobsFeedClient({ profile, initialJobs, initialError }: JobsFeedClientProps) {
  const [jobs, setJobs] = useState<DiscoveredJob[]>(initialJobs);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(initialJobs.length === 0);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const autoTriggeredRef = useRef<boolean>(false);
  const router = useRouter();

  const triggerDiscover = useCallback(async () => {
    setIsDiscovering(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/jobs/discover', { method: 'POST' });
      if (!res.ok) {
        const errorData = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || 'Failed to discover jobs.');
      }
      const data = (await res.json()) as { jobs?: unknown[] };
      if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
        const normalized = normalizeDiscoveredJobs(data.jobs);
        const roleFiltered = filterDiscoveredJobsForTargetRole(normalized, profile?.targetRole ?? '');
        const jobsToRank = roleFiltered.length > 0 ? roleFiltered : normalized;
        const ranked = personalizeAndRankDiscoveredJobs(jobsToRank, profile?.skills ?? []);
        setJobs(ranked.length > 0 ? ranked : jobsToRank);
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Job discovery is updating.';
      setLoadError(msg);
    } finally {
      setIsDiscovering(false);
    }
  }, [profile?.skills, profile?.targetRole, router]);

  useEffect(() => {
    if ((jobs.length === 0 || initialJobs.length === 0) && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      void triggerDiscover();
    }
  }, [jobs.length, initialJobs.length, triggerDiscover]);

  return (
    <>
      {isDiscovering && jobs.length === 0 ? (
        <Card className="mt-6 rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#D93829]" aria-hidden="true" />
            <h3 className="mt-4 text-base font-semibold text-stone-100">Fetching tailored opportunities...</h3>
            <p className="mt-1 max-w-md text-xs text-stone-400 leading-relaxed">
              Scanning live ATS feeds and calibrating roles for your candidate profile.
            </p>
          </CardContent>
        </Card>
      ) : jobs.length > 0 ? (
        <section className="mt-6" aria-labelledby="matches-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">Ranked by relevance</p>
              <h2 id="matches-heading" className="mt-0.5 text-lg font-bold text-stone-100">Best opportunities for you</h2>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-mono text-xs text-stone-500">{jobs.length} published {jobs.length === 1 ? 'role' : 'roles'}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void triggerDiscover()}
                disabled={isDiscovering}
                className="h-8 rounded-lg border-stone-700 bg-stone-800/80 px-2.5 text-xs text-stone-300 hover:bg-stone-700"
              >
                <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isDiscovering && 'animate-spin')} />
                {isDiscovering ? 'Scanning...' : 'Refresh'}
              </Button>
            </div>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            {jobs.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        </section>
      ) : (
        <Card className="mt-6 rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardContent className="py-14">
            <EmptyState
              icon={<BriefcaseBusiness className="h-6 w-6 text-stone-400" />}
              title="No jobs available right now"
              description={
                loadError
                  ? 'Job feeds are updating in the background. Please refresh in a moment.'
                  : 'The discovery engine is scanning verified ATS feeds and official MSOT postings. Complete your candidate profile to unlock calibrated opportunities.'
              }
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button
                    onClick={() => void triggerDiscover()}
                    disabled={isDiscovering}
                    className="rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21]"
                  >
                    <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isDiscovering && 'animate-spin')} />
                    {isDiscovering ? 'Scanning...' : 'Scan for Opportunities'}
                  </Button>
                  <Link href="/dashboard/profile">
                    <Button variant="outline" className="rounded-lg border-stone-700 bg-stone-800 px-4 text-xs font-semibold text-stone-200 hover:bg-stone-700">
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Complete Profile
                    </Button>
                  </Link>
                  <Link href="/tracker">
                    <Button variant="outline" className="rounded-lg border-stone-700 bg-stone-800 px-4 text-xs font-semibold text-stone-200 hover:bg-stone-700">
                      View Application Tracker
                    </Button>
                  </Link>
                </div>
              }
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
