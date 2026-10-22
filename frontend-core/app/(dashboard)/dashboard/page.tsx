'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Code2,
  Files,
  KanbanSquare,
  Loader2,
  Lock,
  Mic2,
  RefreshCw,
  Send,
  Trophy,
} from 'lucide-react';
import { CurvyRoadmapTimeline } from '@/components/dashboard/CurvyRoadmapTimeline';
import { LogoFillBackground } from '@/components/dashboard/LogoFillBackground';
import { BreakdownMeter } from '@/components/readiness/breakdown-meter';
import { ReadinessRing } from '@/components/readiness/readiness-ring';
import { checkRound1Completed } from '@/lib/round-status';
import {
  READINESS_CATEGORY_LABELS,
  buildDashboardRoadmap,
  buildNextBestActions,
  readinessTier,
} from '@/lib/dashboard-readiness';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { useApplicationStore } from '@/stores/application-store';
import { IntroSequence } from '@/components/IntroSequence';
import { isTourCompleted } from '@/lib/tour-storage';
import type { ReadinessScore } from '@/types';

const GUEST_MOCK_READINESS: ReadinessScore = {
  totalScore: 0,
  readinessLevel: 'Not ready',
  topActions: [],
  breakdown: {
    resume: { rawScore: 0, weight: 0.25, weightedPoints: 0, present: false },
    github: { rawScore: 0, weight: 0.15, weightedPoints: 0, present: false },
    projects: { rawScore: 0, weight: 0.20, weightedPoints: 0, present: false },
    linkedin: { rawScore: 0, weight: 0.10, weightedPoints: 0, present: false },
    leetcode: { rawScore: 0, weight: 0.10, weightedPoints: 0, present: false },
    mock_interview: { rawScore: 0, weight: 0.20, weightedPoints: 0, present: false },
  },
};

const QUICK_LINKS = [
  { href: '/dashboard/interview', label: 'Interview Studio', description: 'Round 1 technical viva & speech practice', icon: Mic2 },
  { href: '/dashboard/interview/coding', label: 'Coding IDE', description: 'Round 2 DSA & web dev challenge', icon: Code2 },
  { href: '/dashboard/review-details', label: 'Detailed Review', description: 'Pass/fail audit, rewrites & raw JSON', icon: Trophy },
  { href: '/dashboard/tracker', label: 'Applications', description: 'Internshala-style ATS pipeline tracker', icon: KanbanSquare },
  { href: '/dashboard/jobs', label: 'Jobs & Internships', description: 'Verified role matches & 1-click apply', icon: BriefcaseBusiness },
  { href: '/dashboard/profile', label: 'Profile Evidence', description: 'Manage resume, GitHub, and credentials', icon: Files },
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

  const hydrateProfile = useProfileStore((state) => state.hydrate);

  const applications = useApplicationStore((state) => state.applications);
  const isHydrated = useApplicationStore((state) => state.isHydrated);
  const hydrateApplications = useApplicationStore((state) => state.hydrate);
  const [isRound1Done, setIsRound1Done] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (user?.id) {
      void hydrateProfile(user.id);
      void hydrateApplications(user.id);
    }
  }, [hydrateApplications, hydrateProfile, user?.id]);

  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const forceTour = params?.get('tour') === '1' || params?.get('intro') === '1';
    const completed = !forceTour && isTourCompleted({
      userId: user?.id,
      onboardingCompletedAt: user?.onboardingCompletedAt,
    });
    if (!completed) {
      setShowIntro(true);
    }
  }, [user?.id, user?.onboardingCompletedAt]);

  useEffect(() => {
    void checkRound1Completed(user?.id).then((done) => setIsRound1Done(done));
  }, [user?.id]);

  const visibleReadiness = user ? readiness : GUEST_MOCK_READINESS;
  const roadmap = useMemo(() => {
    const nodes = buildDashboardRoadmap(visibleReadiness);
    return user ? nodes : nodes.map((node) => ({
      ...node,
      actionHref: '/auth',
    }));
  }, [user, visibleReadiness]);
  const nextBestActions = useMemo(() => {
    if (visibleReadiness?.topActions && visibleReadiness.topActions.length > 0) {
      return visibleReadiness.topActions.slice(0, 5).map((act, index) => {
        const cat = (act.category || '').toLowerCase();
        const href = cat.includes('interview')
          ? '/dashboard/interview'
          : cat.includes('coding')
            ? '/dashboard/interview/coding'
            : '/dashboard/profile';
        return {
          category: (act.category || `action-${index}`) as any,
          title: act.title,
          description: act.description || `Potential point gain: +${act.potentialPointGain ?? 0}`,
          href: user ? href : '/auth',
          score: Math.max(0, 100 - (act.potentialPointGain ?? 0)),
        };
      });
    }
    const actions = buildNextBestActions(visibleReadiness);
    return user ? actions : actions.map((action) => ({ ...action, href: '/auth' }));
  }, [user, visibleReadiness]);
  const score = user ? visibleReadiness?.totalScore ?? 0 : 0;
  const tier = user ? readinessTier(score, visibleReadiness?.readinessLevel) : 'Building readiness';
  const rawUserName = (user as unknown as { user_metadata?: { name?: string } })?.user_metadata?.name
    || user?.displayName
    || profile?.displayName
    || 'Guest';
  const firstName = rawUserName.split(/\s+/)[0] || 'Guest';
  const targetRole = user ? profile?.targetRole ?? user?.targetRole ?? 'your target role' : 'your target role';
  const status = user ? review?.status ?? (isAnalyzing ? 'processing' : 'pending') : 'pending';

  const appCounts = useMemo(() => {
    return {
      total: user ? applications.length : 0,
      applied: user ? applications.filter((a) => a.status === 'applied').length : 0,
      shortlisted: user ? applications.filter((a) => a.status === 'shortlisted').length : 0,
      interviewing: user ? applications.filter((a) => a.status === 'interviewing').length : 0,
      offer: user ? applications.filter((a) => a.status === 'offer').length : 0,
    };
  }, [applications, user]);

  return (
    <div className="relative min-h-screen">
      <LogoFillBackground />
      <div className="relative z-10 space-y-10 pb-24">
        {showIntro && (
          <IntroSequence
            open={showIntro}
            onClose={() => setShowIntro(false)}
          />
        )}
        <section className="relative overflow-hidden rounded-2xl border border-stone-800 bg-stone-900 p-6 shadow-md shadow-black/40 sm:p-9">
          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-stone-800 bg-stone-800 px-3.5 py-1 text-xs font-semibold text-stone-300">
                Dashboard overview
              </div>
              <h1 className="mt-5 font-display text-3xl font-bold text-stone-100 sm:text-5xl">
                Build the proof, {firstName}.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400 sm:text-base">
                Your roadmap is set for <strong className="font-semibold text-stone-100">{targetRole}</strong>. Scores below come from the evidence we have reviewed.
              </p>
              <AnalysisStatus
                status={status}
                error={user ? review?.errorMessage ?? error : null}
                isAnalyzing={Boolean(user && isAnalyzing)}
                onRetry={user?.id ? () => void analyze(user.id) : undefined}
              />
            </div>

            <div className="flex flex-col items-center rounded-xl border border-stone-800 bg-stone-950 p-5 sm:p-7">
              <ReadinessRing score={score} level={tier} />
              {user && !readiness && !review?.updatedAt ? (
                <Link
                  href="/dashboard/profile"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-red-600/40 bg-red-600/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-600/20 hover:text-red-300 transition-colors text-center"
                >
                  <span>Upload your Profile to generate your first score</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <p className="mt-1 text-center text-xs text-stone-500">{formatUpdatedAt(visibleReadiness?.updatedAt ?? (user ? review?.updatedAt : undefined))}</p>
              )}
            </div>
          </div>
        </section>

        {/* Internshala-Style Student Application Pipeline Metric Bar */}
        <section aria-labelledby="pipeline-metrics" className="rounded-2xl border border-stone-800 bg-stone-900 p-5 shadow-md shadow-black/40 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-4">
            <div>
              <p className="text-xs font-semibold text-stone-400">Application tracker</p>
              <h2 id="pipeline-metrics" className="mt-0.5 text-lg font-bold text-stone-100">Placement activity</h2>
            </div>
            <Link href={user ? '/dashboard/tracker' : '/auth'} className="inline-flex items-center text-xs font-semibold text-red-500 hover:text-red-400">
              View application pipeline <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-stone-800 bg-stone-950 p-3.5 text-center">
              <span className="text-xs text-stone-500">Total applications</span>
              <p className="mt-1 text-xl font-bold text-stone-100">{appCounts.total}</p>
            </div>
            <div className="rounded-xl border border-stone-800 bg-stone-950 p-3.5 text-center">
              <span className="text-xs text-stone-500">In review</span>
              <p className="mt-1 text-xl font-bold text-stone-300">{appCounts.applied}</p>
            </div>
            <div className="rounded-xl border border-stone-800 bg-stone-950 p-3.5 text-center">
              <span className="text-xs text-stone-500">Shortlisted</span>
              <p className="mt-1 text-xl font-bold text-stone-300">{appCounts.shortlisted}</p>
            </div>
            <div className="rounded-xl border border-stone-800 bg-stone-950 p-3.5 text-center">
              <span className="text-xs text-stone-500">Interviews</span>
              <p className="mt-1 text-xl font-bold text-stone-300">{appCounts.interviewing}</p>
            </div>
            <div className="rounded-xl border border-stone-800 bg-stone-950 p-3.5 text-center">
              <span className="text-xs text-stone-500">Offers received</span>
              <p className="mt-1 text-xl font-bold text-red-500">{appCounts.offer}</p>
            </div>
          </div>
        </section>

        {/* 2-Round Mock Interview Center Banner */}
        <section aria-labelledby="interview-hub-heading" className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-400">Mock interview practice</p>
              <h2 id="interview-hub-heading" className="mt-1 text-xl font-bold text-stone-100">Two-round interview practice</h2>
            </div>
            <p className="text-xs text-stone-500">Interview questions and code exercises</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Round 1 Card */}
            <div className="flex flex-col justify-between rounded-2xl border border-stone-800 bg-stone-900 p-6 shadow-md shadow-black/40">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-800 bg-stone-800 px-3 py-1 text-xs font-bold text-stone-300">
                    <Mic2 className="h-3.5 w-3.5" /> Round 1: Technical Viva
                  </span>
                  <span className="text-xs text-stone-500">15–20 minutes</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-stone-100">Technical conversation</h3>
                <p className="mt-2 text-xs leading-relaxed text-stone-400">
                  Voice or text technical interview evaluating your conceptual foundation, system architecture, trade-offs, and HR questions with real-time adaptive follow-ups.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span className="text-xs text-stone-400">Based on your profile</span>
                <Link href={user ? '/dashboard/interview' : '/auth'}>
                  <button className="flex items-center gap-1.5 rounded-lg bg-stone-800 px-4 py-2 text-xs font-bold text-stone-100 transition-colors hover:bg-red-600">
                    Start round 1 <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </Link>
              </div>
            </div>

            {/* Round 2 Card */}
            <div className={`flex flex-col justify-between rounded-2xl border p-6 shadow-md shadow-black/40 transition-colors ${
              isRound1Done
                ? 'border-stone-800 bg-stone-900'
                : 'border-stone-800/80 bg-stone-900/60 opacity-80'
            }`}>
              <div>
                <div className="flex items-center justify-between">
                  {isRound1Done ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-800 bg-stone-800 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-300">
                      <Code2 className="h-3.5 w-3.5 text-stone-400" /> Round 2: DSA + web dev IDE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-orange-400">
                      <Lock className="h-3.5 w-3.5" /> Round 2: Locked (Complete Round 1 First)
                    </span>
                  )}
                  <span className="text-xs text-stone-500">{isRound1Done ? 'Interactive editor' : 'Prerequisite: Round 1'}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-stone-100">Coding exercise</h3>
                <p className="mt-2 text-xs leading-relaxed text-stone-400">
                  Integrated in-browser Monaco IDE. Write algorithms, execute test cases, and receive instant AI analysis comparing your solution against the optimal benchmark.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span className="text-xs text-stone-400">
                  {isRound1Done ? 'Check your solution' : 'Unlocks after Technical Viva'}
                </span>
                {isRound1Done ? (
                  <Link href={user ? '/dashboard/interview/coding' : '/auth'}>
                    <button className="flex items-center gap-1.5 rounded-lg bg-stone-800 px-4 py-2 text-xs font-bold text-stone-100 transition-colors hover:bg-red-600">
                      Open coding editor <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                ) : (
                  <Link href={user ? '/dashboard/interview' : '/auth'}>
                    <button className="flex items-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900 px-4 py-2 text-xs font-bold text-stone-400 hover:text-stone-200 transition-colors">
                      Locked · Complete Round 1 <Lock className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="readiness-breakdown" aria-labelledby="breakdown-heading" className="scroll-mt-24 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-2xl border border-stone-800 bg-stone-900 p-6 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-stone-400">Evidence reviewed</p>
                <h2 id="breakdown-heading" className="mt-1 text-xl font-bold text-stone-100">Readiness breakdown</h2>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard/review-details"
                  className="text-xs text-[#D93829] hover:underline font-medium"
                >
                  View Granular Diagnostic &rarr;
                </Link>
                <span className="text-xs text-stone-500">Six evaluation pillars &middot; 100 total points</span>
              </div>
            </div>
            <div className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">
              {READINESS_CATEGORY_LABELS.map(({ key, label }) => {
                const item = visibleReadiness?.breakdown[key] ||
                  (key === 'leetcode' ? visibleReadiness?.breakdown['coding_practice'] : undefined);
                const maxPointsMap: Record<string, number> = {
                  resume: 25,
                  github: 15,
                  projects: 20,
                  linkedin: 10,
                  leetcode: 10,
                  mock_interview: 20,
                };
                return (
                  <div key={key}>
                    <BreakdownMeter
                      label={label}
                      value={item}
                      maxPoints={maxPointsMap[key] ?? 20}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-stone-800 bg-stone-900 p-6 sm:p-7">
            <div>
              <p className="text-xs font-semibold text-stone-400">Highest impact</p>
              <h2 className="mt-1 text-xl font-bold text-stone-100">Next best actions</h2>
              {nextBestActions.length ? (
                <ol className="mt-5 space-y-3">
                  {nextBestActions.slice(0, 3).map((action, index) => (
                    <li key={action.category}>
                      <Link href={action.href} className="group flex gap-3 rounded-xl border border-stone-800 bg-stone-950 p-3.5 transition hover:border-[#D93829]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#D93829]/15 text-xs font-bold text-[#D93829]">{index + 1}</span>
                        <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className="text-sm font-medium text-stone-200">{action.title}</span><span className="shrink-0 text-xs text-[#D93829]">{action.score}/100</span></span><span className="mt-1 block text-xs leading-relaxed text-stone-500">{action.description}</span></span>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-stone-600 transition-transform group-hover:translate-x-1 group-hover:text-[#D93829]" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-stone-800 p-5 text-sm leading-relaxed text-stone-500">Actions will appear after the readiness engine completes its first evidence review.</div>
              )}
            </div>
            <div className="mt-5 pt-4 border-t border-stone-800/80">
              <Link
                href="/dashboard/action-plan"
                className="group flex w-full items-center justify-between rounded-xl border border-stone-800 bg-stone-950/80 px-4 py-2.5 text-xs font-semibold text-stone-300 transition hover:border-[#D93829]/60 hover:bg-stone-950 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
              >
                <span>See detailed action plan</span>
                <span className="flex items-center gap-1 font-bold text-[#D93829] transition-transform group-hover:translate-x-1">
                  &rarr;
                </span>
              </Link>
            </div>
          </div>
        </section>

        <CurvyRoadmapTimeline nodes={roadmap} />

        <section aria-labelledby="quick-links-heading">
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold text-stone-400">Continue</p><h2 id="quick-links-heading" className="mt-1 text-xl font-bold text-stone-100">Quick links</h2></div></div>
          <div className="grid gap-4 md:grid-cols-3">
            {QUICK_LINKS.map(({ href, label, description, icon: Icon }) => (
              <Link key={href} href={!user && href !== '/dashboard/jobs' ? '/auth' : href} className="group rounded-2xl border border-stone-800 bg-stone-900 p-5 transition hover:border-red-600/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                <div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-stone-800 text-red-500"><Icon className="h-5 w-5" aria-hidden="true" /></span><ArrowRight className="h-4 w-4 text-stone-600 transition-transform group-hover:translate-x-1 group-hover:text-red-500" aria-hidden="true" /></div>
                <h3 className="mt-4 font-semibold text-stone-200">{label}</h3><p className="mt-1 text-xs text-stone-500">{description}</p>
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
        {onRetry && <button type="button" onClick={onRetry} disabled={isAnalyzing} className="inline-flex items-center gap-1.5 rounded-lg bg-stone-800 px-3 py-1.5 font-semibold hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"><RefreshCw className={`h-3.5 w-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />Retry</button>}
      </div>
    );
  }
  if (status === 'processing' || isAnalyzing) return <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-red-600/30 bg-red-600/10 px-3.5 py-2 text-xs text-red-200" role="status"><Loader2 className="h-3.5 w-3.5 animate-spin" />Reviewing evidence without blocking your workspace</p>;
  if (status === 'completed') return <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-stone-700 bg-stone-800 px-3.5 py-2 text-xs text-stone-300" role="status"><span className="h-2 w-2 rounded-full bg-red-600" />Latest review complete</p>;
  return <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-stone-800 bg-stone-950 px-3.5 py-2 text-xs text-stone-500" role="status"><span className="h-2 w-2 rounded-full bg-stone-600" />Preparing your first evidence review</p>;
}
