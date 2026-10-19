'use client';

import { useState } from 'react';
import { CheckCircle2, ExternalLink, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyCard } from '@/components/review/copy-card';
import type { CandidateProfileReview, CandidateProject } from '@/types';

type TabId = 'resume' | 'github' | 'linkedin' | 'projects';
interface ReviewTabsProps { review: CandidateProfileReview; projects: CandidateProject[]; }

function Status({ pass }: { pass: boolean }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${pass ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200'}`}>{pass ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> : <XCircle className="mr-1.5 h-3.5 w-3.5" />}{pass ? 'Pass' : 'Action required'}</span>;
}

export function ReviewTabs({ review, projects }: ReviewTabsProps) {
  const [active, setActive] = useState<TabId>('resume');
  const [checking, setChecking] = useState<string | null>(null);
  const [projectMessages, setProjectMessages] = useState<Record<string, string>>({});
  const tabs: Array<{ id: TabId; label: string }> = [{ id: 'resume', label: 'Resume' }, { id: 'github', label: 'GitHub' }, { id: 'linkedin', label: 'LinkedIn' }, { id: 'projects', label: 'Live links' }];
  const checkProject = async (projectId: string) => {
    setChecking(projectId);
    try {
      const response = await fetch('/api/projects/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) });
      const payload: unknown = await response.json();
      const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
      setProjectMessages((current) => ({ ...current, [projectId]: response.ok && record.is_live === true ? `Live · quality ${Math.round(Number(record.quality_score) || 0)}%` : String(record.error ?? 'Action required') }));
    } catch { setProjectMessages((current) => ({ ...current, [projectId]: 'Check unavailable' })); } finally { setChecking(null); }
  };

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div role="tablist" aria-label="Profile review categories" className="flex overflow-x-auto border-b border-white/10 p-2">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} onClick={() => setActive(tab.id)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${active === tab.id ? 'bg-indigo-500/15 text-indigo-100' : 'text-muted-foreground hover:text-white'}`}>{tab.label}</button>)}</div>
      <div className="p-5 md:p-7">
        {active === 'resume' && <div className="space-y-5"><ScoreHeading label="Resume score" score={review.resume_review.score} /><div className="grid gap-3 sm:grid-cols-3"><Evidence label="One page" pass={review.resume_review.is_one_page} /><Evidence label="ATS friendly" pass={review.resume_review.is_ats_friendly} /><Evidence label="Action verbs" pass={review.resume_review.uses_action_verbs} /></div>{review.resume_review.specific_fixes.map((fix) => <CopyCard key={fix} text={fix} label="Specific fix" />)}</div>}
        {active === 'github' && <div className="space-y-5"><ScoreHeading label="GitHub score" score={review.github_review.score} />{review.github_review.specific_fixes.map((fix) => <CopyCard key={fix} text={fix} label="Repository action" />)}</div>}
        {active === 'linkedin' && (review.linkedin_review ? <div className="space-y-5"><ScoreHeading label="LinkedIn score" score={review.linkedin_review.score} /><div className="grid gap-3 sm:grid-cols-2"><Evidence label="Complete profile" pass={review.linkedin_review.has_complete_profile} /><Evidence label="Relevant skills" pass={review.linkedin_review.skills_relevant} /></div>{review.linkedin_review.suggested_rewrites.map((rewrite) => <CopyCard key={rewrite} text={rewrite} label="Suggested rewrite" />)}</div> : <p className="py-12 text-center text-muted-foreground">LinkedIn was not assessed.</p>)}
        {active === 'projects' && <div className="space-y-3">{projects.map((project) => <div key={project.id} className="flex flex-col gap-3 rounded-xl border border-white/[0.07] p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-medium">{project.name}</p><p className="truncate text-sm text-muted-foreground">{project.liveUrl ?? 'No live URL supplied'}</p>{projectMessages[project.id] && <p className="mt-1 text-xs text-indigo-200">{projectMessages[project.id]}</p>}</div>{project.liveUrl && <><a href={project.liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm text-indigo-300">Open<ExternalLink className="ml-1 h-3.5 w-3.5" /></a><Button size="sm" variant="outline" disabled={checking === project.id} onClick={() => void checkProject(project.id)}><RefreshCw className={`mr-2 h-3.5 w-3.5 ${checking === project.id ? 'animate-spin' : ''}`} />Recheck</Button></>}</div>)}</div>}
      </div>
    </div>
  );
}

function ScoreHeading({ label, score }: { label: string; score: number }) { return <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{label}</h2><span className="text-3xl font-semibold text-indigo-200">{Math.round(score)}%</span></div>; }
function Evidence({ label, pass }: { label: string; pass: boolean }) { return <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><p className="mb-3 text-sm text-muted-foreground">{label}</p><Status pass={pass} /></div>; }
