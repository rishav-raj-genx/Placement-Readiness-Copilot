'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BriefcaseBusiness, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { JobBoard } from '@/components/jobs/job-board';
import { ApplicationKanban } from '@/components/jobs/application-kanban';
import { useApplicationStore } from '@/stores/application-store';
import { useAuthStore } from '@/stores/auth-store';
import { useJobStore } from '@/stores/job-store';
import { normalizeDiscoveredJobs } from '@/lib/data-adapters';
import type { JobPosting } from '@/types';
import { toast } from 'sonner';
import { isOfficialJob } from '@/lib/jobs';
import { matchesJobProfile } from '@/lib/job-matching';

type JobsTab = 'matched' | 'official' | 'tracker';

function JobsWorkspace() {
  const params = useSearchParams();
  const [tab, setTab] = useState<JobsTab>(params.get('tab') === 'tracker' ? 'tracker' : 'matched');
  const [discoveredMatches, setDiscoveredMatches] = useState<JobPosting[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const autoDiscoveryRequested = useRef(false);
  const user = useAuthStore((state) => state.user);
  const { jobs, matchedJobs: storedMatches, isHydrated, hydrate } = useJobStore();
  const {
    applications,
    isHydrated: applicationsHydrated,
    error: applicationsError,
    hydrate: hydrateApplications,
    addApplication,
    moveApplication,
  } = useApplicationStore();

  const matchProfile = useMemo(() => ({
    id: user?.id,
    targetRole: user?.targetRole ?? '',
    skills: user?.skills ?? [],
  }), [user?.id, user?.skills, user?.targetRole]);

  useEffect(() => {
    if (user?.id) {
      void hydrate(matchProfile);
      void hydrateApplications(user.id);
    } else {
      void hydrate(undefined);
      void hydrateApplications(undefined);
    }
  }, [hydrate, hydrateApplications, matchProfile, user?.id]);

  const discover = useCallback(async () => {
    setDiscovering(true);
    setDiscoveryError(null);
    try {
      const response = await fetch('/api/jobs/discover', { method: 'POST' });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'Discovery unavailable.'
        );
      }
      const rawJobs = typeof payload === 'object' && payload !== null && 'jobs' in payload ? payload.jobs : [];
      setDiscoveredMatches(
        normalizeDiscoveredJobs(rawJobs).filter((job) => matchesJobProfile(job, matchProfile))
      );
    } catch (error) {
      setDiscoveryError(error instanceof Error ? error.message : 'Discovery unavailable.');
      setDiscoveredMatches(storedMatches);
    } finally {
      setDiscovering(false);
    }
  }, [matchProfile, storedMatches]);

  useEffect(() => {
    if (!isHydrated || autoDiscoveryRequested.current) return;
    autoDiscoveryRequested.current = true;
    void discover();
  }, [discover, isHydrated]);

  const applyAndLog = async (job: JobPosting) => {
    if (!user || !job.applicationUrl) return;
    window.open(job.applicationUrl, '_blank', 'noopener,noreferrer');
    try {
      await addApplication({
        jobId: job.id,
        userId: user.id,
        company: job.company,
        jobTitle: job.title,
        status: 'applied',
        applicationDate: new Date().toISOString().slice(0, 10),
        jobPostingUrl: job.applicationUrl,
      });
      toast.success('Application opened and logged.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not log the application.');
    }
  };

  const officialJobs = jobs.filter((job) => job.status === 'published' && isOfficialJob(job));
  const fallbackMatched = discoveredMatches.length ? discoveredMatches : storedMatches;
  const tabs: Array<{ id: JobsTab; label: string }> = [
    { id: 'matched', label: 'Matched jobs' },
    { id: 'official', label: 'Official opportunities' },
    { id: 'tracker', label: 'Application tracker' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs workspace"
        description="Discover profile-matched roles, browse official placements, and track each application in one place."
        action={
          tab === 'matched' ? (
            <Button
              variant="outline"
              disabled={discovering}
              onClick={() => void discover()}
              className="rounded-lg border-stone-800 bg-stone-900 text-xs font-medium text-stone-200 hover:bg-stone-800"
            >
              {discovering ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
              Refresh matches
            </Button>
          ) : undefined
        }
      />

      <div role="tablist" aria-label="Jobs workspace" className="inline-flex rounded-lg border border-stone-800 bg-[#28201E] p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
              tab === item.id
                ? 'border border-stone-700 bg-stone-800 text-stone-100 shadow-none'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {discoveryError && tab === 'matched' && (
        <p className="rounded-lg border border-amber-900/40 bg-amber-950/30 px-3.5 py-2.5 text-xs text-amber-300">
          Automation unavailable; showing Supabase fallback. {discoveryError}
        </p>
      )}

      {tab === 'matched' && (
        <JobBoard jobs={fallbackMatched} onApply={applyAndLog} emptyMessage="No matched jobs are available yet." />
      )}

      {tab === 'official' && (
        <JobBoard jobs={officialJobs} onApply={applyAndLog} emptyMessage="No official jobs are currently published." />
      )}

      {tab === 'tracker' && applicationsError && (
        <p role="alert" className="rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-2.5 text-xs text-red-300">
          {applicationsError}
        </p>
      )}

      {tab === 'tracker' && !applicationsHydrated && (
        <div className="grid min-h-48 place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-stone-500" />
        </div>
      )}

      {tab === 'tracker' && applicationsHydrated && applications.length > 0 && (
        <ApplicationKanban applications={applications} onMove={moveApplication} />
      )}

      {tab === 'tracker' && applicationsHydrated && applications.length === 0 && (
        <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-stone-800 bg-stone-900/40 p-8 text-center">
          <div>
            <BriefcaseBusiness className="mx-auto h-7 w-7 text-stone-500" />
            <h2 className="mt-3 text-sm font-semibold text-stone-200">No applications yet</h2>
            <p className="mt-1 text-xs text-stone-400">Apply to a matched job and it will appear here.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="grid min-h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-stone-500" /></div>}>
      <JobsWorkspace />
    </Suspense>
  );
}
