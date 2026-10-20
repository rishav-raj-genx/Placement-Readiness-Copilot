'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BriefcaseBusiness,
  FileSearch,
  Files,
  Loader2,
  Mic2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { CurvyRoadmapTimeline } from '@/components/dashboard/CurvyRoadmapTimeline';
import { LogoFillBackground } from '@/components/dashboard/LogoFillBackground';
import { BreakdownMeter } from '@/components/readiness/breakdown-meter';
import { ReadinessRing } from '@/components/readiness/readiness-ring';
import {
  READINESS_CATEGORY_LABELS,
  buildDashboardRoadmap,
  buildNextBestActions,
  readinessTier,
} from '@/lib/dashboard-readiness';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';

const QUICK_LINKS = [
  { href: '/interview/configure', label: 'Interview', description: 'Start a 15-minute AI viva', icon: Mic2 },
  { href: '#readiness-breakdown', label: 'Review Engine', description: 'Jump to your verified readiness breakdown', icon: FileSearch },
  { href: '/dashboard/jobs', label: 'Jobs', description: 'Open role matches and official jobs', icon: BriefcaseBusiness },
  { href: '/dashboard/profile', label: 'Profile', description: 'Manage identity and documents', icon: Files },
] as const;

function formatUpdatedAt(value?: string): string {
  if (!value) return 'Waiting for first analysis';
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return 'Update time unavailable';
  return `Updated ${timestamp.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
}

export default function DashboardHomePage() {
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  const review = useProfileStore((state) => state.review);
  const readiness = useProfileStore((state) => state.readiness);
  const isAnalyzing = useProfileStore((state) => state.isAnalyzing);
  const error = useProfileStore((state) => state.error);
  const analyze = useProfileStore((state) => state.analyze);
  const roadmap = useMemo(() => buildDashboardRoadmap(readiness), [readiness]);
  const nextBestActions = useMemo(() => buildNextBestActions(readiness), [readiness]);
  const score = readiness?.totalScore;
  const tier = readinessTier(score, readiness?.readinessLevel);
  const firstName = (profile?.displayName ?? user?.displayName ?? 'Candidate').split(/\s+/)[0];
  const targetRole = profile?.targetRole ?? user?.targetRole ?? 'your target role';
  const status = review?.status ?? (isAnalyzing ? 'processing' : 'pending');

  return (
    <div className="relative min-h-screen">
      <LogoFillBackground />
      <div className="relative z-10 space-y-10 pb-24">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#111A2D]/95 via-[#0E1728]/95 to-[#091521]/95 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-9">
          <div aria-hidden="true" className="absolute -right-24 -top-28 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-indigo-200">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />Evidence-backed command center
              </div>
              <h1 className="mt-5 font-[var(--font-display)] text-3xl font-black tracking-tight text-white sm:text-5xl">
                Build the proof, {firstName}.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
                Your roadmap is calibrated for <strong className="font-semibold text-white">{targetRole}</strong>. Scores below come only from assessed evidence.
              </p>
              <AnalysisStatus
                status={status}
                error={review?.errorMessage ?? error}
                isAnalyzing={isAnalyzing}
                onRetry={user?.id ? () => void analyze(user.id) : undefined}
              />
            </div>

            <div className="flex flex-col items-center rounded-3xl border border-white/10 bg-black/15 p-5 sm:p-7">
              <ReadinessRing score={score} level={tier} />
              <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">{formatUpdatedAt(readiness?.updatedAt ?? review?.updatedAt)}</p>
            </div>
          </div>
        </section>

        <section id="readiness-breakdown" aria-labelledby="breakdown-heading" className="scroll-mt-24 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl border border-white/10 bg-[#0E1728]/80 p-6 backdrop-blur-xl sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">Weighted evidence</p><h2 id="breakdown-heading" className="mt-1 text-xl font-bold text-white">Readiness breakdown</h2></div>
              <p className="text-xs text-white/40">Six categories · 100 total points</p>
            </div>
            <div className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">
              {READINESS_CATEGORY_LABELS.map(({ key, label }) => <BreakdownMeter key={key} label={label} value={readiness?.breakdown[key]} />)}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0E1728]/80 p-6 backdrop-blur-xl sm:p-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-violet-300">Highest impact</p>
            <h2 className="mt-1 text-xl font-bold text-white">Next best actions</h2>
            {nextBestActions.length ? (
              <ol className="mt-5 space-y-3">
                {nextBestActions.map((action, index) => (
                  <li key={action.category}>
                    <Link href={action.href} className="group flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 transition hover:border-violet-300/25 hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/15 font-mono text-xs font-bold text-violet-200">{index + 1}</span>
                      <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className="text-sm font-medium text-white">{action.title}</span><span className="shrink-0 font-mono text-[10px] text-violet-200">{action.score}/100</span></span><span className="mt-1 block text-xs leading-relaxed text-white/45">{action.description}</span></span>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/25 transition-transform group-hover:translate-x-1 group-hover:text-violet-200" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-5 text-sm leading-relaxed text-white/45">Actions will appear after the readiness engine completes its first evidence review.</div>
            )}
          </div>
        </section>

        <CurvyRoadmapTimeline nodes={roadmap} />

        <section aria-labelledby="quick-links-heading">
          <div className="mb-4 flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-indigo-300">Keep moving</p><h2 id="quick-links-heading" className="mt-1 text-xl font-bold text-white">Quick links</h2></div></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {QUICK_LINKS.map(({ href, label, description, icon: Icon }) => (
              <Link key={href} href={href} className="group rounded-2xl border border-white/10 bg-[#0E1728]/75 p-5 backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-300/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                <div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-200"><Icon className="h-5 w-5" aria-hidden="true" /></span><ArrowRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-cyan-200" aria-hidden="true" /></div>
                <h3 className="mt-4 font-semibold text-white">{label}</h3><p className="mt-1 text-xs text-white/45">{description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

interface AnalysisStatusProps {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string | null;
  isAnalyzing: boolean;
  onRetry?: () => void;
}

function AnalysisStatus({ status, error, isAnalyzing, onRetry }: AnalysisStatusProps) {
  if (status === 'failed' || error) {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-100" role="status">
        <span className="flex-1">{error ?? 'Profile analysis failed. Your dashboard remains available.'}</span>
        {onRetry && <button type="button" onClick={onRetry} disabled={isAnalyzing} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><RefreshCw className={`h-3.5 w-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />Retry</button>}
      </div>
    );
  }
  if (status === 'processing' || isAnalyzing) return <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3.5 py-2 text-xs text-cyan-100" role="status"><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyzing evidence without blocking your workspace</p>;
  if (status === 'completed') return <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-100" role="status"><span className="h-2 w-2 rounded-full bg-emerald-300" />Latest review complete</p>;
  return <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs text-white/55" role="status"><span className="h-2 w-2 rounded-full bg-white/30" />Preparing your first evidence review</p>;
}
