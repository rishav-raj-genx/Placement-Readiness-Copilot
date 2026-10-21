'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  AudioLines,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';
import type { FacultyVivaRecord, VivaTranscriptTurn } from '@/lib/admin-interviews';

interface AdminInterviewsWorkspaceProps {
  interviews: FacultyVivaRecord[];
  loadError: string | null;
}

function formatDate(value: string): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatTimestamp(value: number): string {
  const seconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'CA';
}

function errorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) return value.message;
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) return record.message;
  }
  return fallback;
}

function activeTranscriptIndex(transcript: VivaTranscriptTurn[], currentTime: number): number {
  let activeIndex = -1;
  for (let index = 0; index < transcript.length; index += 1) {
    if (transcript[index].timestampSeconds <= currentTime) activeIndex = index;
    else break;
  }
  return activeIndex;
}

export function AdminInterviewsWorkspace({ interviews, loadError }: AdminInterviewsWorkspaceProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [selected, setSelected] = useState<FacultyVivaRecord | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const openAudit = (interview: FacultyVivaRecord): void => {
    setSelected(interview);
    setCurrentTime(0);
    setOverrideScore(String(interview.effectiveScore));
    setOverrideReason('');
  };

  const closeAudit = useCallback((): void => {
    if (isSaving) return;
    setSelected(null);
    setCurrentTime(0);
  }, [isSaving]);

  useEffect(() => {
    if (!selected) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') closeAudit();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selected, closeAudit]);

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, interview: FacultyVivaRecord): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openAudit(interview);
    }
  };

  const seekToTurn = (turn: VivaTranscriptTurn): void => {
    const audio = audioRef.current;
    if (!audio || !selected?.audioUrl) return;
    audio.currentTime = turn.timestampSeconds;
    setCurrentTime(turn.timestampSeconds);
    void audio.play().catch(() => undefined);
  };

  const handleOverride = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selected || isSaving) return;
    const score = Number(overrideScore);
    const reason = overrideReason.trim();
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      toast.error('Override score must be between 0 and 100.');
      return;
    }
    if (!reason) {
      toast.error('A reason for the override is required.');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('override_interview_score', {
        p_interview_id: selected.id,
        p_override_score: score,
        p_reason: reason,
      });
      if (error) throw error;
      toast.success('Score overridden and faculty audit logged.');
      setSelected(null);
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Unable to save the score override.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <section className="rounded-2xl border border-stone-800 bg-[#121826] p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Faculty audit queue</p>
            <h1 className="mt-2 font-[var(--font-display)] text-3xl font-bold tracking-tight text-stone-100 sm:text-4xl">Faculty viva reviews</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-400">Audit scored interviews, replay timestamped recordings, and record faculty overrides.</p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl border border-stone-800 bg-stone-900/60 px-4 py-3">
              <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Completed</p>
              <p className="mt-1 text-2xl font-bold text-stone-100">{interviews.length}</p>
            </div>
            <div className="rounded-xl border border-stone-800 bg-stone-900/60 px-4 py-3">
              <p className="font-mono text-xs uppercase tracking-wider text-rose-400">Needs review</p>
              <p className="mt-1 text-2xl font-bold text-rose-400">{interviews.filter((interview) => interview.needsReview).length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-800 bg-[#121826] p-5 sm:p-7" aria-labelledby="recent-vivas-heading">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Recent activity</p>
            <h2 id="recent-vivas-heading" className="mt-1 text-lg font-bold text-stone-100">Student mock interviews</h2>
          </div>
          <SlidersHorizontal className="h-5 w-5 text-stone-400" aria-hidden="true" />
        </div>

        {loadError && interviews.length > 0 && (
          <div className="mt-5 rounded-xl border border-red-900/50 bg-red-950/40 p-4 text-sm text-red-300" role="alert">{loadError}</div>
        )}

        {interviews.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-stone-800 px-5 py-14 text-center">
            <MessageSquareText className="mx-auto h-8 w-8 text-stone-500" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-stone-200">0 Completed Interviews</p>
            <p className="mt-1 text-xs text-stone-400">Completed viva sessions will appear here for faculty review.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left">
              <thead>
                <tr className="border-b border-stone-800 font-mono text-xs uppercase tracking-wider text-stone-400">
                  <th className="px-4 pb-3 font-medium">Student name</th>
                  <th className="px-4 pb-3 font-medium">Target role</th>
                  <th className="px-4 pb-3 font-medium text-right">Score</th>
                  <th className="px-4 pb-3 font-medium">Date</th>
                  <th className="px-4 pb-3 font-medium">Review status</th>
                  <th className="px-4 pb-3"><span className="sr-only">Open audit</span></th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((interview) => (
                  <tr
                    key={interview.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Review ${interview.studentName}'s interview for ${interview.targetRole}`}
                    onClick={() => openAudit(interview)}
                    onKeyDown={(event) => handleRowKeyDown(event, interview)}
                    className="group cursor-pointer border-b border-stone-800/80 outline-none transition-colors hover:bg-stone-900/40 focus-visible:bg-stone-900/60"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-stone-700 bg-stone-800 font-mono text-xs font-semibold text-stone-200">
                          {initials(interview.studentName)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-stone-100">{interview.studentName}</span>
                          <span className="block truncate text-xs text-stone-400">{interview.studentEmail || interview.studentId}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-stone-300">{interview.targetRole}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-mono text-base font-bold text-stone-100">{Math.round(interview.aiScore)}</span>
                      <span className="text-xs text-stone-500">/100</span>
                      {interview.override && (
                        <span className="ml-2 rounded border border-orange-500/20 bg-orange-500/10 px-1.5 py-0.5 text-xs font-semibold text-orange-400">
                          → {Math.round(interview.effectiveScore)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-stone-400">{formatDate(interview.completedAt)}</td>
                    <td className="px-4 py-3.5">
                      {interview.needsReview ? (
                        <span className="inline-flex items-center gap-1.5 rounded border border-amber-900/60 bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-300">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />Needs review
                        </span>
                      ) : interview.aiConfidence === null ? (
                        <span className="inline-flex items-center gap-1.5 rounded border border-stone-700 bg-stone-800 px-2 py-0.5 text-xs text-stone-400">
                          Uncalibrated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded border border-stone-700 bg-stone-800 px-2 py-0.5 text-xs font-medium text-stone-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-stone-400" />Standard
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-stone-500 transition-transform group-hover:translate-x-0.5 group-hover:text-stone-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeAudit();
            }}
          >
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="viva-audit-title"
              initial={reduceMotion ? false : { x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 250, damping: 30 }}
              className="absolute inset-y-0 right-0 w-full max-w-5xl overflow-y-auto border-l border-stone-800 bg-[#121826] shadow-lg shadow-black/50"
            >
              <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-800 bg-[#121826]/95 px-5 py-4 backdrop-blur-sm sm:px-7">
                <div className="min-w-0">
                  <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Faculty audit</p>
                  <h2 id="viva-audit-title" className="mt-0.5 truncate text-lg font-bold text-stone-100">
                    {selected.studentName} · {selected.targetRole}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeAudit}
                  disabled={isSaving}
                  aria-label="Close audit drawer"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-stone-800 text-stone-400 transition hover:bg-stone-800 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-6">
                  <section className="rounded-xl border border-stone-800 bg-stone-900/60 p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-wider text-stone-400">Evidence playback</p>
                        <h3 className="mt-0.5 text-base font-bold text-stone-100">Transcript &amp; audio</h3>
                      </div>
                      {selected.aiConfidence !== null && (
                        <span className="rounded border border-stone-700 bg-stone-800 px-2 py-1 text-xs font-medium text-stone-300">
                          Confidence {Math.round(selected.aiConfidence * 100)}%
                        </span>
                      )}
                    </div>

                    <div className="mt-4 rounded-lg border border-stone-800 bg-stone-950/60 p-3">
                      <audio
                        ref={audioRef}
                        controls
                        preload="metadata"
                        src={selected.audioUrl ?? undefined}
                        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                        className="w-full"
                        aria-label="Interview audio recording"
                      >
                        Your browser does not support audio playback.
                      </audio>
                      {!selected.audioUrl && (
                        <p className="mt-2 flex items-center gap-2 px-1 text-xs text-stone-400">
                          <AudioLines className="h-3.5 w-3.5" />
                          No recording attached. Timestamped transcript evidence remains available below.
                        </p>
                      )}
                    </div>

                    <div className="mt-4 max-h-[26rem] space-y-2.5 overflow-y-auto pr-2" aria-label="Interview transcript">
                      {selected.transcript.length > 0 ? (
                        selected.transcript.map((turn, index) => {
                          const active = index === activeTranscriptIndex(selected.transcript, currentTime);
                          return (
                            <button
                              key={turn.id}
                              type="button"
                              onClick={() => seekToTurn(turn)}
                              disabled={!selected.audioUrl}
                              className={`block w-full rounded-lg border p-3.5 text-left transition-colors ${
                                turn.speaker === 'student' ? 'ml-auto max-w-[92%]' : 'mr-auto max-w-[92%]'
                              } ${
                                active
                                  ? 'border-orange-500 bg-orange-500/10'
                                  : 'border-stone-800 bg-stone-950/40 hover:border-stone-700'
                              } disabled:cursor-default`}
                            >
                              <span className="flex items-center justify-between gap-3">
                                <span className={`text-xs font-semibold ${
                                  turn.speaker === 'student' ? 'text-stone-200' : 'text-orange-400'
                                }`}>
                                  {turn.speaker === 'student' ? 'Student' : 'Interviewer'}
                                </span>
                                <span className="inline-flex items-center gap-1 font-mono text-xs text-stone-500">
                                  <Clock3 className="h-3 w-3" />
                                  {formatTimestamp(turn.timestampSeconds)}
                                </span>
                              </span>
                              <span className="mt-1.5 block text-xs leading-relaxed text-stone-300">
                                {turn.text}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <p className="rounded-lg border border-dashed border-stone-800 px-4 py-8 text-center text-xs text-stone-400">
                          No transcript retained for this session.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-xl border border-stone-800 bg-stone-900/60 p-5 sm:p-6">
                    <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Evaluation</p>
                    <h3 className="mt-0.5 text-base font-bold text-stone-100">Rubric breakdown</h3>
                    {selected.summary && (
                      <p className="mt-2 text-xs leading-relaxed text-stone-400">{selected.summary}</p>
                    )}
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {selected.rubric.length > 0 ? (
                        selected.rubric.map((rubric) => (
                          <div key={rubric.key} className="rounded-lg border border-stone-800 bg-stone-950/60 p-3.5">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-medium text-stone-200">{rubric.label}</p>
                              <span className="font-mono text-xs font-bold text-stone-100">
                                {Math.round(rubric.score)}/100
                              </span>
                            </div>
                            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-stone-800">
                              <div
                                className="h-full rounded-full bg-orange-500"
                                style={{ width: `${rubric.score}%` }}
                              />
                            </div>
                            {rubric.feedback && (
                              <p className="mt-2 text-xs leading-relaxed text-stone-400">{rubric.feedback}</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-stone-500">No category rubric included.</p>
                      )}
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="rounded-xl border border-stone-800 bg-stone-900/70 p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Score control</p>
                        <h3 className="mt-0.5 text-base font-bold text-stone-100">Faculty override</h3>
                      </div>
                      <ShieldCheck className="h-5 w-5 text-orange-400" />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-3">
                        <p className="font-mono text-xs uppercase tracking-wider text-stone-500">Original AI</p>
                        <p className="mt-1 text-xl font-bold text-stone-100">
                          {Math.round(selected.aiScore)}
                          <span className="text-xs text-stone-500">/100</span>
                        </p>
                      </div>
                      <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-3">
                        <p className="font-mono text-xs uppercase tracking-wider text-stone-500">Effective</p>
                        <p className="mt-1 text-xl font-bold text-orange-400">
                          {Math.round(selected.effectiveScore)}
                          <span className="text-xs text-stone-500">/100</span>
                        </p>
                      </div>
                    </div>

                    {selected.override && (
                      <div className="mt-3.5 rounded-lg border border-stone-800 bg-stone-950/40 p-3">
                        <p className="text-xs font-medium text-stone-200">
                          Last overridden by {selected.override.facultyName}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-500">{formatDate(selected.override.overriddenAt)}</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-stone-400">{selected.override.reason}</p>
                      </div>
                    )}

                    <form onSubmit={(event) => void handleOverride(event)} className="mt-4 space-y-3.5">
                      <div>
                        <label htmlFor="override-score" className="text-xs font-medium text-stone-300">
                          Override score
                        </label>
                        <input
                          id="override-score"
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={overrideScore}
                          onChange={(event) => setOverrideScore(event.target.value)}
                          disabled={isSaving}
                          className="mt-1.5 h-10 w-full rounded-lg border border-stone-800 bg-stone-950/80 px-3 text-sm text-stone-200 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="override-reason" className="text-xs font-medium text-stone-300">
                          Reason for override <span className="text-rose-400">*</span>
                        </label>
                        <textarea
                          id="override-reason"
                          required
                          rows={4}
                          value={overrideReason}
                          onChange={(event) => setOverrideReason(event.target.value)}
                          disabled={isSaving}
                          placeholder="Explain the evidence and rubric basis for changing this score…"
                          className="mt-1.5 w-full resize-y rounded-lg border border-stone-800 bg-stone-950/80 px-3 py-2 text-xs leading-relaxed text-stone-200 outline-none placeholder:text-stone-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 text-xs font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        {isSaving ? 'Saving audit…' : 'Confirm score override'}
                      </button>
                    </form>
                  </section>

                  <section className="rounded-xl border border-stone-800 bg-stone-900/60 p-5">
                    <p className="font-mono text-xs uppercase tracking-wider text-stone-400">Session metadata</p>
                    <dl className="mt-3 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="inline-flex items-center gap-1.5 text-stone-400">
                          <UserRound className="h-3.5 w-3.5" />Candidate
                        </dt>
                        <dd className="text-right font-medium text-stone-200">{selected.studentName}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="inline-flex items-center gap-1.5 text-stone-400">
                          <CalendarDays className="h-3.5 w-3.5" />Completed
                        </dt>
                        <dd className="text-right font-medium text-stone-200">{formatDate(selected.completedAt)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-stone-400">Session ID</dt>
                        <dd className="max-w-[12rem] truncate font-mono text-xs text-stone-400">{selected.id}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
