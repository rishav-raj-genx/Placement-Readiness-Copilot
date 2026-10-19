'use client';

import { BriefcaseBusiness, ExternalLink, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JobPosting } from '@/types';

interface JobBoardProps { jobs: JobPosting[]; onApply: (job: JobPosting) => Promise<void>; emptyMessage: string; }

export function JobBoard({ jobs, onApply, emptyMessage }: JobBoardProps) {
  if (jobs.length === 0) return <div className="glass-panel grid min-h-56 place-items-center rounded-2xl p-8 text-center"><div><BriefcaseBusiness className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">{emptyMessage}</p></div></div>;
  return <div className="grid gap-4 lg:grid-cols-2">{jobs.map((job) => <article key={job.id} className="glass-panel flex flex-col rounded-2xl p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">{job.title}</h2><p className="mt-1 text-sm text-slate-300">{job.company}</p></div>{typeof job.matchScore === 'number' && <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-200">{job.matchScore}% match</span>}</div><p className="mt-3 flex items-center text-xs text-muted-foreground"><MapPin className="mr-1.5 h-3.5 w-3.5" />{job.location}</p><p className="mt-3 line-clamp-3 flex-1 text-sm text-muted-foreground">{job.matchReason ?? job.description}</p><div className="mt-4 flex flex-wrap gap-1.5">{job.requiredSkills.slice(0, 6).map((skill) => <span key={skill} className="rounded-md bg-white/[0.05] px-2 py-1 text-xs text-slate-300">{skill}</span>)}</div><div className="mt-5 flex items-center justify-between"><span className="text-xs text-muted-foreground">{job.source ?? 'Discovery service'}</span><Button size="sm" disabled={!job.applicationUrl} onClick={() => void onApply(job)}>Apply &amp; Log<ExternalLink className="ml-2 h-3.5 w-3.5" /></Button></div></article>)}</div>;
}
