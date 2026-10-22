'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Cloud, Code2, Cpu, Loader2, Lock, MessageSquare, Mic2, Plus, Radio, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/page-header';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { useLiveKitInterviewStore } from '@/stores/livekit-interview-store';
import {
  LiveKitApiError,
  createInterviewSession,
  getLiveKitClientConfiguration,
} from '@/lib/livekit-session';
import { resolveInterviewFocusTopics } from '@/lib/interview-config';
import { RoleCombobox } from '@/components/interview/RoleCombobox';
import { InterviewLimitModal } from '@/components/interview/InterviewLimitModal';
import { checkRound1Completed } from '@/lib/round-status';
import type { CompanyType, Difficulty, ExperienceLevel, LiveKitSessionRequest } from '@/types';
import { toast } from '@/lib/toast';

const durations = [15, 20] as const;
const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'adaptive'];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-stone-300">
        {label}
        {hint && <span className="ml-2 font-normal text-stone-500">{hint}</span>}
      </Label>
      {children}
    </div>
  );
}

export default function ConfigureInterviewPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  const hydrateProfile = useProfileStore((state) => state.hydrate);
  const { startInterview, setCreating, setCreateError, isCreating, createError } = useLiveKitInterviewStore();

  const isPremium = profile?.isPremium === true;
  const interviewCredits = typeof profile?.interviewCredits === 'number' ? profile.interviewCredits : 3;
  const isLocked = !isPremium && interviewCredits <= 0;

  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [roundType, setRoundType] = useState<'round1' | 'round2' | 'both'>('round1');
  const [isRound1Done, setIsRound1Done] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [provider, setProvider] = useState<'cloud_api' | 'ollama_local'>('cloud_api');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('entry_level');
  const [companyType, setCompanyType] = useState<CompanyType>('other');
  const [targetCompany, setTargetCompany] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [isLaunchingRound2, setIsLaunchingRound2] = useState(false);
  const livekitConfiguration = getLiveKitClientConfiguration();

  useEffect(() => {
    if (user?.id) {
      void checkRound1Completed(user.id).then((done) => setIsRound1Done(done));
      void hydrateProfile(user.id);
    }
  }, [hydrateProfile, user?.id]);

  // Initialize once from profile evidence without clobbering user keystrokes
  useEffect(() => {
    if (profile?.targetRole) {
      setTargetRole((current) => current || profile.targetRole || '');
    }
    if (profile?.skills?.length) {
      setTopics((current) => (current.length === 0 ? profile.skills.slice(0, 6) : current));
    }
  }, [profile?.targetRole, profile?.skills]);

  const addTopic = () => {
    const topic = topicInput.trim();
    if (topic && !topics.includes(topic)) {
      setTopics((current) => [...current, topic]);
    }
    setTopicInput('');
  };

  const removeTopic = (topicToRemove: string) => {
    setTopics((current) => current.filter((item) => item !== topicToRemove));
  };

  const handleTargetRoleChange = useCallback((value: string) => {
    setTargetRole(value);
  }, []);

  const handleStartClick = () => {
    if (isLocked || interviewCredits <= 0) {
      setShowPaywallModal(true);
      return;
    }
    void begin();
  };

  const begin = async () => {
    if (isLocked || interviewCredits <= 0) {
      setShowPaywallModal(true);
      return;
    }

    if (roundType === 'round2') {
      setIsLaunchingRound2(true);
      router.push('/dashboard/interview/coding');
      return;
    }

    const normalizedTargetRole = targetRole.trim();
    if (!normalizedTargetRole) {
      toast.error('Please select a target role.');
      return;
    }
    if (!user) {
      toast.error('Your session has expired. Please sign in again.');
      return;
    }

    const focusTopics = resolveInterviewFocusTopics(normalizedTargetRole, topics);
    setCreating(true);
    setCreateError(null);
    try {
      const request: LiveKitSessionRequest = {
        studentId: user.id,
        targetRole: normalizedTargetRole,
        topics: focusTopics,
        focusAreas: focusTopics,
        difficulty,
        durationMinutes,
        experienceLevel,
        companyType,
        targetCompany: targetCompany.trim() || undefined,
        customInstructions: customInstructions.trim() || undefined,
        mode,
        provider,
      };
      const session = await createInterviewSession(request);
      await hydrateProfile(user.id);
      startInterview(
        session.interviewId,
        session.roomName,
        normalizedTargetRole,
        session.serverUrl,
        session.token,
        durationMinutes,
        focusTopics,
        mode,
        provider
      );
      router.push(`/dashboard/interview/session/${session.interviewId}?mode=${mode}&provider=${provider}`);
    } catch (error) {
      if (
        (error instanceof LiveKitApiError && (error.code === 'LIMIT_EXCEEDED' || error.status === 403)) ||
        (error instanceof Error && (error.message.includes('LIMIT_EXCEEDED') || error.message.includes('Free tier limit') || error.message.includes('Out of credits')))
      ) {
        setShowPaywallModal(true);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unable to create the interview.';
      setCreateError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Interview studio"
        description={
          user
            ? "Two-Round AI Evaluation Unlocked. Practice theoretical system design viva or live coding with IDE."
            : "Preview Mode: Sign in to unlock the two-round technical interview assessment system."
        }
      />

      {/* Round Selection Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setRoundType('round1')}
          className={`flex flex-col rounded-2xl border p-5 text-left transition-colors ${
            roundType === 'round1'
              ? 'border-[#D93829] bg-[#28201E]'
              : 'border-stone-800 bg-[#28201E]/60 hover:border-stone-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-stone-800 bg-stone-900 text-stone-200">
                <Mic2 className="h-4 w-4" />
              </span>
              <div>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500">Round 1</span>
                <h3 className="text-sm font-bold text-stone-100">Technical viva</h3>
              </div>
            </div>
            {user ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                Unlocked · Ready
              </span>
            ) : (
              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
                Sign In to Unlock
              </span>
            )}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-stone-400">
            15–20 min voice technical viva covering fundamentals, system architecture, trade-offs, and HR.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!user) {
              router.push('/signup?redirect=/dashboard/interview');
              return;
            }
            if (isLocked || interviewCredits <= 0) {
              setShowPaywallModal(true);
              return;
            }
            if (!isRound1Done) {
              toast.info('Round 2 is locked. Please complete Round 1 Technical Viva first!');
              return;
            }
            setRoundType('round2');
          }}
          className={`flex flex-col rounded-2xl border p-5 text-left transition-colors ${
            roundType === 'round2'
              ? 'border-[#D93829] bg-[#28201E]'
              : !user || !isRound1Done
              ? 'border-stone-800 bg-[#28201E]/40 opacity-75 cursor-not-allowed'
              : 'border-stone-800 bg-[#28201E]/60 hover:border-stone-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={`grid h-8 w-8 place-items-center rounded-lg border border-stone-800 ${user && isRound1Done ? 'bg-stone-900 text-stone-200' : 'bg-orange-500/10 text-orange-400'}`}>
                {user && isRound1Done ? <Code2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </span>
              <div>
                <span className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${user && isRound1Done ? 'text-stone-500' : 'text-orange-400'}`}>
                  {user && isRound1Done ? 'Round 2' : 'Round 2 (Locked)'}
                </span>
                <h3 className="text-sm font-bold text-stone-100">DSA + web dev IDE</h3>
              </div>
            </div>
            {!user ? (
              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
                Sign In to Unlock
              </span>
            ) : isRound1Done ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                Unlocked · Ready
              </span>
            ) : (
              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
                Finish Round 1 First
              </span>
            )}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-stone-400">
            {user && isRound1Done
              ? 'Interactive in-browser code editor testing algorithm efficiency (O(N) vs O(N²)) and architecture.'
              : 'Unlocks after completing Round 1 Technical Viva. Live IDE with benchmark evaluation and test cases.'}
          </p>
        </button>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-stone-800 bg-[#28201E] p-5 md:p-7">
        {isLocked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl border border-orange-500/30 bg-[#1c1615]/90 p-6 text-center backdrop-blur-md">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-400 shadow-lg shadow-orange-500/20">
              <Lock className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-bold tracking-tight text-white md:text-xl">
              Out of Free Credits. Upgrade to Premium.
            </h3>
            <p className="mt-2.5 max-w-lg text-xs leading-relaxed text-stone-300 md:text-sm">
              You have used your 3 free AI mock interviews. Unlimited interviews, advanced analytics, and priority MSOT job matching require a Premium upgrade. Payment gateway integration is pending—please contact a platform Admin to verify your payment and manually unlock your account.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-xl border border-orange-500/40 bg-orange-600/15 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-orange-300">
                <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                Admin Verification Required
              </div>
            </div>
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Target Role with Searchable Combobox */}
          <Field label="Target role">
            <RoleCombobox value={targetRole} onChange={handleTargetRoleChange} />
          </Field>

          {/* Target Company */}
          <Field label="Target company" hint="Optional">
            <Input
              value={targetCompany}
              onChange={(event) => setTargetCompany(event.target.value)}
              placeholder="e.g. Stripe, Google, Startup"
              className="border-stone-800 bg-stone-900 text-stone-200 placeholder:text-stone-500 focus-visible:border-[#D93829] focus-visible:ring-[#D93829]"
            />
          </Field>

          {/* Experience Level */}
          <Field label="Experience level">
            <select
              className="h-10 w-full rounded-lg border border-stone-800 bg-stone-900 px-3 text-sm text-stone-200 focus:border-[#D93829] focus:outline-none focus:ring-1 focus:ring-[#D93829]"
              value={experienceLevel}
              onChange={(event) => setExperienceLevel(event.target.value as ExperienceLevel)}
            >
              <option value="internship">Internship</option>
              <option value="entry_level">Entry level</option>
              <option value="one_to_three">1–3 years</option>
              <option value="three_plus">3+ years</option>
            </select>
          </Field>

          {/* Company Type */}
          <Field label="Company type">
            <select
              className="h-10 w-full rounded-lg border border-stone-800 bg-stone-900 px-3 text-sm text-stone-200 focus:border-[#D93829] focus:outline-none focus:ring-1 focus:ring-[#D93829]"
              value={companyType}
              onChange={(event) => setCompanyType(event.target.value as CompanyType)}
            >
              <option value="product_based">Product</option>
              <option value="startup">Startup</option>
              <option value="service_based">Service</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </div>

        {/* Focus Topics */}
        <div className="mt-6">
          <Label className="text-xs font-medium text-stone-300">Focus topics</Label>
          <div className="mt-2 flex gap-2">
            <Input
              value={topicInput}
              onChange={(event) => setTopicInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTopic();
                }
              }}
              placeholder="Add a topic (e.g. Distributed Systems, React, Algorithms)"
              className="border-stone-800 bg-stone-900 text-stone-200 placeholder:text-stone-500 focus-visible:border-[#D93829] focus-visible:ring-[#D93829]"
            />
            <Button
              variant="outline"
              type="button"
              onClick={addTopic}
              className="border-stone-800 bg-stone-900 text-stone-200 hover:bg-stone-800"
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">Add topic</span>
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {topics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => removeTopic(topic)}
                className="inline-flex items-center rounded-md border border-[#D93829]/30 bg-[#D93829]/10 px-2.5 py-1 text-xs text-stone-200 hover:bg-[#D93829]/20 transition-colors"
              >
                {topic}
                <X className="ml-1.5 h-3 w-3 text-stone-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty & Duration */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Field label="Difficulty">
            <div className="grid grid-cols-4 gap-2">
              {difficulties.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setDifficulty(item)}
                  className={`rounded-lg border px-2 py-2 text-xs capitalize transition-colors ${
                    difficulty === item
                      ? 'border-stone-700 bg-stone-800 text-stone-100 font-semibold'
                      : 'border-stone-800 bg-stone-900 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                  }`}
                >
                  {difficulty === item && <Check className="mr-1 inline h-3 w-3 text-[#D93829]" />}
                  {item}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Duration">
            <div className="grid grid-cols-2 gap-2">
              {durations.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setDurationMinutes(minutes)}
                  className={`rounded-lg border px-3 py-2 text-xs font-mono transition-colors ${
                    durationMinutes === minutes
                      ? 'border-stone-700 bg-stone-800 text-stone-100 font-semibold'
                      : 'border-stone-800 bg-stone-900 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                  }`}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Mode & Engine Provider Toggles */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Field label="Interview mode" hint="Select real-time voice or keyboard chat">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('voice')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                  mode === 'voice'
                    ? 'border-[#D93829] bg-[#D93829]/10 text-stone-100 font-semibold'
                    : 'border-stone-800 bg-stone-900 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                }`}
              >
                <Mic2 className="h-3.5 w-3.5 text-[#D93829]" />
                Voice Mode
              </button>
              <button
                type="button"
                onClick={() => setMode('text')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                  mode === 'text'
                    ? 'border-[#D93829] bg-[#D93829]/10 text-stone-100 font-semibold'
                    : 'border-stone-800 bg-stone-900 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5 text-[#D93829]" />
                Text Mode
              </button>
            </div>
          </Field>

          <Field label="AI engine provider" hint="Local mode disables Deepgram cloud audio">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProvider('cloud_api')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                  provider === 'cloud_api'
                    ? 'border-stone-700 bg-stone-800 text-stone-100 font-semibold'
                    : 'border-stone-800 bg-stone-900 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                }`}
              >
                <Cloud className="h-3.5 w-3.5 text-orange-400" />
                Cloud API
              </button>
              <button
                type="button"
                onClick={() => setProvider('ollama_local')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                  provider === 'ollama_local'
                    ? 'border-stone-700 bg-stone-800 text-stone-100 font-semibold'
                    : 'border-stone-800 bg-stone-900 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                }`}
              >
                <Cpu className="h-3.5 w-3.5 text-orange-500" />
                Ollama (Local)
              </button>
            </div>
          </Field>
        </div>

        {/* Custom Instructions */}
        <div className="mt-6">
          <Field label="Interviewer instructions" hint="Optional">
            <Textarea
              rows={4}
              value={customInstructions}
              onChange={(event) => setCustomInstructions(event.target.value)}
              placeholder="e.g. Focus on concurrency tradeoffs, ask challenging follow-up questions, and evaluate scalability."
              className="border-stone-800 bg-stone-900 text-stone-200 placeholder:text-stone-500 focus-visible:border-[#D93829] focus-visible:ring-[#D93829]"
            />
          </Field>
        </div>

        {createError && (
          <p role="alert" className="mt-5 rounded-xl border border-red-900/40 bg-red-950/30 px-3.5 py-2.5 text-xs text-red-300">
            {createError}
          </p>
        )}

        {roundType !== 'round2' && livekitConfiguration.status !== 'ready' && (
          <div role="status" className="mt-5 flex items-start gap-2.5 rounded-xl border border-orange-900/40 bg-orange-950/30 px-3.5 py-3 text-xs text-orange-300">
            <Radio className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <p>
              The LiveKit server stream is initializing. Your interview selections are safe;
              retry shortly if the session does not begin after deployment finishes.
            </p>
          </div>
        )}

        {/* Action Controls */}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-stone-800/80 pt-5">
          <p className="text-xs text-stone-500">
            Profile skills, target role, and past evidence are automatically applied.
          </p>
          {!user ? (
            <Link
              href="/signup?redirect=/dashboard/interview"
              className="inline-flex items-center rounded-lg bg-[#D93829] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21]"
            >
              Sign up to unlock interview studio
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          ) : (
            <Button
              onClick={handleStartClick}
              disabled={isCreating || isLaunchingRound2}
              data-testid="start-interview-button"
              className={
                isLocked
                  ? 'rounded-lg border border-[#D93829]/50 bg-[#D93829]/20 px-4 py-2 text-xs font-semibold text-[#FF6B4A] shadow-[0_0_15px_rgba(217,56,41,0.25)] transition-all hover:bg-[#D93829]/30 hover:border-[#D93829] active:bg-[#D93829]/40 cursor-pointer'
                  : 'rounded-lg bg-[#D93829] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B] disabled:opacity-50'
              }
            >
              {isCreating || isLaunchingRound2 ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isLocked ? (
                <Lock className="mr-2 h-4 w-4 text-[#FF6B4A]" />
              ) : null}
              {isLocked ? (
                <>Start Interview</>
              ) : roundType === 'round2' ? (
                <>
                  <Code2 className="mr-2 h-4 w-4" />
                  Launch coding IDE (Round 2)
                </>
              ) : (
                <>
                  Begin technical viva (Round 1)
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </section>

      {/* Paywall Modal for Exhausted Free Tier */}
      <InterviewLimitModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        onReturnToDashboard={() => {
          setShowPaywallModal(false);
          router.push('/dashboard');
        }}
      />
    </div>
  );
}
