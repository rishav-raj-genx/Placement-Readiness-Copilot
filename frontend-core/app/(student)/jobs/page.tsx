'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
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

type JobsTab = 'matched' | 'official' | 'tracker';

function JobsWorkspace() {
  const params = useSearchParams();
  const [tab, setTab] = useState<JobsTab>(params.get('tab') === 'tracker' ? 'tracker' : 'matched');
  const [matchedJobs, setMatchedJobs] = useState<JobPosting[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const autoDiscoveryRequested = useRef(false);
  const user = useAuthStore((state) => state.user);
  const { jobs, isHydrated, hydrate } = useJobStore();
  const { applications, isHydrated: applicationsHydrated, hydrate: hydrateApplications, addApplication, moveApplication } = useApplicationStore();
  useEffect(() => { if (!isHydrated) void hydrate(); }, [hydrate, isHydrated]);
  useEffect(() => { if (user?.id && !applicationsHydrated) void hydrateApplications(user.id); }, [applicationsHydrated, hydrateApplications, user?.id]);

  const discover = useCallback(async () => {
    setDiscovering(true); setDiscoveryError(null);
    try {
      const response = await fetch('/api/jobs/discover', { method: 'POST' });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(typeof payload === 'object' && payload !== null && 'error' in payload ? String(payload.error) : 'Discovery unavailable.');
      const rawJobs = typeof payload === 'object' && payload !== null && 'jobs' in payload ? payload.jobs : [];
      setMatchedJobs(normalizeDiscoveredJobs(rawJobs));
    } catch (error) {
      setDiscoveryError(error instanceof Error ? error.message : 'Discovery unavailable.');
      setMatchedJobs(jobs.filter((job) => !isOfficialJob(job)));
    } finally { setDiscovering(false); }
  }, [jobs]);

  useEffect(() => {
    if (!isHydrated || autoDiscoveryRequested.current) return;
    autoDiscoveryRequested.current = true;
    void discover();
  }, [discover, isHydrated]);

  const applyAndLog = async (job: JobPosting) => {
    if (!user || !job.applicationUrl) return;
    window.open(job.applicationUrl, '_blank', 'noopener,noreferrer');
    try {
      await addApplication({ jobId: job.id, userId: user.id, company: job.company, jobTitle: job.title, status: 'applied', applicationDate: new Date().toISOString().slice(0, 10), jobPostingUrl: job.applicationUrl });
      toast.success('Application opened and logged.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not log the application.'); }
  };

  const officialJobs = jobs.filter((job) => job.status === 'published' && isOfficialJob(job));
  const fallbackMatched = matchedJobs.length ? matchedJobs : jobs.filter((job) => job.status === 'published' && !isOfficialJob(job));
  const tabs: Array<{ id: JobsTab; label: string }> = [{ id: 'matched', label: 'Matched jobs' }, { id: 'official', label: 'Hireable Official' }, { id: 'tracker', label: 'Tracker' }];

  return <div className="space-y-6"><PageHeader title="Jobs Workspace" description="Discover profile-matched roles, browse official placements, and track each application in one place." action={tab === 'matched' ? <Button variant="outline" disabled={discovering} onClick={() => void discover()}>{discovering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh matches</Button> : undefined} /><div role="tablist" aria-label="Jobs workspace" className="inline-flex rounded-xl border border-white/10 bg-slate-950/60 p-1">{tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === item.id ? 'bg-indigo-500/20 text-indigo-100' : 'text-muted-foreground hover:text-white'}`}>{item.label}</button>)}</div>{discoveryError && tab === 'matched' && <p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">Automation unavailable; showing Supabase fallback. {discoveryError}</p>}{tab === 'matched' && <JobBoard jobs={fallbackMatched} onApply={applyAndLog} emptyMessage="No matched jobs are available yet." />}{tab === 'official' && <JobBoard jobs={officialJobs} onApply={applyAndLog} emptyMessage="No Hireable Official jobs are currently published." />}{tab === 'tracker' && <ApplicationKanban applications={applications} onMove={moveApplication} />}</div>;
}

export default function JobsPage() {
  return <Suspense fallback={<div className="grid min-h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}><JobsWorkspace /></Suspense>;
}
