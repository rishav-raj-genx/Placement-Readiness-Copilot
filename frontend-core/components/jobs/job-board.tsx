'use client';

import { useState } from 'react';
import { BriefcaseBusiness, ExternalLink, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import type { JobPosting } from '@/types';

interface JobBoardProps {
  jobs: JobPosting[];
  onApply: (job: JobPosting) => Promise<void>;
  emptyMessage: string;
}

export function JobBoard({ jobs, onApply, emptyMessage }: JobBoardProps) {
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleApply = async (job: JobPosting): Promise<void> => {
    if (applyingId) return;
    setApplyingId(job.id);
    try {
      await onApply(job);
    } finally {
      setApplyingId(null);
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-800 bg-[#28201E] p-8">
        <EmptyState
          icon={<BriefcaseBusiness className="h-6 w-6 text-stone-400" />}
          title="No opportunities found"
          description={emptyMessage}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {jobs.map((job) => (
        <article key={job.id} className="flex flex-col rounded-2xl border border-stone-800 bg-[#28201E] p-5 text-stone-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-stone-100">{job.title}</h2>
              <p className="mt-0.5 text-xs text-stone-400">{job.company}</p>
            </div>
            {typeof job.matchScore === 'number' && (
              <span className="rounded border border-stone-700 bg-stone-800 px-2 py-0.5 font-mono text-xs font-semibold text-stone-200">
                {job.matchScore}% match
              </span>
            )}
          </div>
          <p className="mt-2.5 flex items-center text-xs text-stone-400">
            <MapPin className="mr-1.5 h-3.5 w-3.5 text-stone-500" />
            {job.location || 'Unspecified location'}
          </p>
          <p className="mt-3 line-clamp-3 flex-1 text-xs leading-relaxed text-stone-300">
            {job.matchReason ?? job.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {job.requiredSkills.slice(0, 6).map((skill) => (
              <span key={skill} className="rounded border border-stone-800 bg-stone-900/80 px-2 py-0.5 text-xs text-stone-400">
                {skill}
              </span>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-stone-800/80 pt-3">
            <span className="font-mono text-xs uppercase tracking-wider text-stone-500">
              {job.source ?? 'Partner role'}
            </span>
            <Button
              size="sm"
              disabled={!job.applicationUrl || applyingId === job.id}
              onClick={() => void handleApply(job)}
              className="rounded-lg bg-[#D93829] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B] disabled:opacity-50"
            >
              {applyingId === job.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              <span>Apply and log</span>
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export default JobBoard;
