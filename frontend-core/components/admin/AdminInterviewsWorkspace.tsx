'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
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

  const closeAudit = (): void => {
    if (isSaving) return;
    setSelected(null);
    setCurrentTime(0);
  };

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
  }, [selected, isSaving]);

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
    <div className="space-y-8 pb-20">
      <section className="relative overflow-hidden rounded-[2rem] border border-violet-300/15 bg-white/[0.035] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-9">
        <div aria-hidden="true" className="absolute -right-28 -top-32 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200">Faculty audit queue</p>
            <h1 className="mt-2 font-[var(--font-display)] text-3xl font-black tracking-tight text-white sm:text-5xl">Faculty Viva Reviews</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50">Audit AI-scored interviews, replay timestamped evidence, and record accountable faculty overrides.</p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl border border-violet-300/15 bg-violet-400/[0.07] px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Completed</p>
              <p className="mt-1 text-2xl font-black text-violet-100">{interviews.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.07] px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Needs review</p>
              <p className="mt-1 text-2xl font-black text-amber-100">{interviews.filter((interview) => interview.needsReview).length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-[#111522]/82 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-7" aria-labelledby="recent-vivas-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-violet-300">Recent activity</p>
            <h2 id="recent-vivas-heading" className="mt-1 text-xl font-bold text-white">Student mock interviews</h2>
          </div>
          <SlidersHorizontal className="h-5 w-5 text-amber-200" aria-hidden="true" />
        </div>

        {loadError && <div className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-400/[0.08] p-5 text-sm text-rose-100" role="alert">{loadError}</div>}

        {interviews.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 px-5 py-14 text-center">
            <MessageSquareText className="mx-auto h-8 w-8 text-white/25" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-white">No completed mock interviews</p>
            <p className="mt-1 text-xs text-white/35">Completed AI viva sessions will appear here for faculty review.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-y-2 text-left">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">
                  <th className="px-4 pb-2 font-medium">Student Name</th>
                  <th className="px-4 pb-2 font-medium">Target Role</th>
                  <th className="px-4 pb-2 font-medium">AI Score</th>
                  <th className="px-4 pb-2 font-medium">Date</th>
                  <th className="px-4 pb-2 font-medium">Review Status</th>
                  <th className="px-4 pb-2"><span className="sr-only">Open audit</span></th>
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
                    className="group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    <td className="rounded-l-2xl border-y border-l border-white/[0.07] bg-white/[0.025] px-4 py-4 transition group-hover:bg-violet-400/[0.06]">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-amber-400 text-[10px] font-black text-white">{initials(interview.studentName)}</span>
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{interview.studentName}</span><span className="block truncate text-[10px] text-white/35">{interview.studentEmail || interview.studentId}</span></span>
                      </div>
                    </td>
                    <td className="border-y border-white/[0.07] bg-white/[0.025] px-4 py-4 text-sm text-white/60 transition group-hover:bg-violet-400/[0.06]">{interview.targetRole}</td>
                    <td className="border-y border-white/[0.07] bg-white/[0.025] px-4 py-4 transition group-hover:bg-violet-400/[0.06]">
                      <span className="font-mono text-lg font-black text-white">{Math.round(interview.aiScore)}</span><span className="text-xs text-white/30">/100</span>
                      {interview.override && <span className="ml-2 rounded-full bg-violet-400/10 px-2 py-1 text-[9px] font-bold uppercase text-violet-200">→ {Math.round(interview.effectiveScore)} override</span>}
                    </td>
                    <td className="border-y border-white/[0.07] bg-white/[0.025] px-4 py-4 text-xs text-white/45 transition group-hover:bg-violet-400/[0.06]">{formatDate(interview.completedAt)}</td>
                    <td className="border-y border-white/[0.07] bg-white/[0.025] px-4 py-4 transition group-hover:bg-violet-400/[0.06]">
                      {interview.needsReview ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-100"><AlertTriangle className="h-3.5 w-3.5" />Needs Review</span>
                      ) : interview.aiConfidence === null ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-white/45">Confidence unavailable</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/[0.08] px-2.5 py-1 text-[10px] font-bold text-emerald-100"><CheckCircle2 className="h-3.5 w-3.5" />Standard</span>
                      )}
                    </td>
                    <td className="rounded-r-2xl border-y border-r border-white/[0.07] bg-white/[0.025] px-4 py-4 text-right transition group-hover:bg-violet-400/[0.06]"><ChevronRight className="ml-auto h-5 w-5 text-white/25 transition group-hover:translate-x-1 group-hover:text-amber-200" /></td>
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
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm"
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
              className="absolute inset-y-0 right-0 w-full max-w-6xl overflow-y-auto border-l border-violet-300/15 bg-[#0B0F17] shadow-[-30px_0_90px_rgba(0,0,0,0.55)]"
            >
              <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#0B0F17]/92 px-5 py-4 backdrop-blur-xl sm:px-7">
                <div className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-200">Faculty audit</p>
                  <h2 id="viva-audit-title" className="mt-1 truncate text-lg font-black text-white">{selected.studentName} · {selected.targetRole}</h2>
                </div>
                <button type="button" onClick={closeAudit} disabled={isSaving} aria-label="Close audit drawer" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/50 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-50"><X className="h-5 w-5" /></button>
              </header>

              <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-6">
                  <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-violet-300">Evidence playback</p><h3 className="mt-1 text-lg font-bold text-white">Transcript &amp; audio</h3></div>
                      {selected.aiConfidence !== null && <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold text-white/55">AI confidence {Math.round(selected.aiConfidence * 100)}%</span>}
                    </div>

                    <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                      <audio ref={audioRef} controls preload="metadata" src={selected.audioUrl ?? undefined} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} className="w-full" aria-label="Interview audio recording">Your browser does not support audio playback.</audio>
                      {!selected.audioUrl && <p className="mt-2 flex items-center gap-2 px-1 text-[11px] text-white/35"><AudioLines className="h-3.5 w-3.5" />No recording URL was attached to this session. Timestamped transcript evidence remains available.</p>}
                    </div>

                    <div className="mt-4 max-h-[30rem] space-y-3 overflow-y-auto pr-2" aria-label="Interview transcript">
                      {selected.transcript.length > 0 ? selected.transcript.map((turn, index) => {
                        const active = index === activeTranscriptIndex(selected.transcript, currentTime);
                        return (
                          <button key={turn.id} type="button" onClick={() => seekToTurn(turn)} disabled={!selected.audioUrl} className={`block w-full rounded-2xl border p-4 text-left transition ${turn.speaker === 'student' ? 'ml-auto max-w-[92%]' : 'mr-auto max-w-[92%]'} ${active ? 'border-amber-300/35 bg-amber-400/10' : 'border-white/[0.07] bg-white/[0.025] hover:border-violet-300/20'} disabled:cursor-default`}>
                            <span className="flex items-center justify-between gap-3"><span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${turn.speaker === 'student' ? 'text-cyan-200' : 'text-violet-200'}`}>{turn.speaker === 'student' ? 'Student' : 'AI interviewer'}</span><span className="inline-flex items-center gap-1 font-mono text-[9px] text-white/30"><Clock3 className="h-3 w-3" />{formatTimestamp(turn.timestampSeconds)}</span></span>
                            <span className="mt-2 block text-sm leading-relaxed text-white/65">{turn.text}</span>
                          </button>
                        );
                      }) : <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/35">No transcript was retained for this session.</p>}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-violet-300">AI evaluation</p>
                    <h3 className="mt-1 text-lg font-bold text-white">Rubric scores</h3>
                    {selected.summary && <p className="mt-3 text-sm leading-relaxed text-white/45">{selected.summary}</p>}
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {selected.rubric.length > 0 ? selected.rubric.map((rubric) => (
                        <div key={rubric.key} className="rounded-2xl border border-white/[0.07] bg-black/15 p-4">
                          <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-white">{rubric.label}</p><span className="font-mono text-sm font-black text-amber-200">{Math.round(rubric.score)}/100</span></div>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-amber-400" style={{ width: `${rubric.score}%` }} /></div>
                          {rubric.feedback && <p className="mt-3 text-xs leading-relaxed text-white/40">{rubric.feedback}</p>}
                        </div>
                      )) : <p className="text-sm text-white/35">No category rubric was included in this result.</p>}
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="rounded-3xl border border-amber-300/15 bg-gradient-to-br from-violet-500/[0.09] to-amber-400/[0.04] p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-200">Score control</p><h3 className="mt-1 text-lg font-bold text-white">Faculty override</h3></div>
                      <ShieldCheck className="h-6 w-6 text-amber-200" />
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"><p className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/30">Original AI</p><p className="mt-1 text-2xl font-black text-white">{Math.round(selected.aiScore)}<span className="text-xs text-white/30">/100</span></p></div>
                      <div className="rounded-2xl border border-violet-300/15 bg-violet-400/[0.07] p-4"><p className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/30">Effective</p><p className="mt-1 text-2xl font-black text-violet-100">{Math.round(selected.effectiveScore)}<span className="text-xs text-white/30">/100</span></p></div>
                    </div>

                    {selected.override && (
                      <div className="mt-4 rounded-2xl border border-violet-300/15 bg-violet-400/[0.06] p-4">
                        <p className="text-xs font-semibold text-violet-100">Last overridden by {selected.override.facultyName}</p>
                        <p className="mt-1 text-[10px] text-white/35">{formatDate(selected.override.overriddenAt)}</p>
                        <p className="mt-2 text-xs leading-relaxed text-white/50">{selected.override.reason}</p>
                      </div>
                    )}

                    <form onSubmit={(event) => void handleOverride(event)} className="mt-5 space-y-4">
                      <div>
                        <label htmlFor="override-score" className="text-xs font-semibold text-white/65">Override score</label>
                        <input id="override-score" type="number" min="0" max="100" step="0.1" value={overrideScore} onChange={(event) => setOverrideScore(event.target.value)} disabled={isSaving} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 text-sm text-white outline-none focus:border-violet-300/45 focus:ring-2 focus:ring-violet-400/15" />
                      </div>
                      <div>
                        <label htmlFor="override-reason" className="text-xs font-semibold text-white/65">Reason for override <span className="text-amber-200">*</span></label>
                        <textarea id="override-reason" required rows={5} value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} disabled={isSaving} placeholder="Explain the evidence and rubric basis for changing this score…" className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-violet-300/45 focus:ring-2 focus:ring-violet-400/15" />
                      </div>
                      <button type="submit" disabled={isSaving} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-amber-500 px-5 text-sm font-black text-white shadow-[0_12px_32px_rgba(139,92,246,0.22)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{isSaving ? 'Saving audit…' : 'Confirm score override'}
                      </button>
                    </form>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-violet-300">Session metadata</p>
                    <dl className="mt-4 space-y-3 text-xs"><div className="flex items-center justify-between gap-4"><dt className="inline-flex items-center gap-1.5 text-white/35"><UserRound className="h-3.5 w-3.5" />Candidate</dt><dd className="text-right font-medium text-white/65">{selected.studentName}</dd></div><div className="flex items-center justify-between gap-4"><dt className="inline-flex items-center gap-1.5 text-white/35"><CalendarDays className="h-3.5 w-3.5" />Completed</dt><dd className="text-right font-medium text-white/65">{formatDate(selected.completedAt)}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-white/35">Session ID</dt><dd className="max-w-[14rem] truncate font-mono text-[10px] text-white/50">{selected.id}</dd></div></dl>
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
