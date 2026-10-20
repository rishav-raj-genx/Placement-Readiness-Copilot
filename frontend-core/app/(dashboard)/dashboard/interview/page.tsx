'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Code2, Loader2, Lock, Mic2, Plus, Radio, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/page-header';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { useLiveKitInterviewStore } from '@/stores/livekit-interview-store';
import { createInterviewSession, getLiveKitClientConfiguration } from '@/lib/livekit-session';
import { resolveInterviewFocusTopics } from '@/lib/interview-config';
import { RoleCombobox } from '@/components/interview/RoleCombobox';
import { checkRound1Completed } from '@/lib/round-status';
import type { CompanyType, Difficulty, ExperienceLevel, LiveKitSessionRequest } from '@/types';
import { toast } from 'sonner';

const durations = [15, 30, 45] as const;
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
  const { startInterview, setCreating, setCreateError, isCreating, createError } = useLiveKitInterviewStore();

  const [roundType, setRoundType] = useState<'round1' | 'round2' | 'both'>('round1');
  const [isRound1Done, setIsRound1Done] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('entry_level');
  const [companyType, setCompanyType] = useState<CompanyType>('other');
  const [targetCompany, setTargetCompany] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const livekitConfiguration = getLiveKitClientConfiguration();

  useEffect(() => {
    void checkRound1Completed(user?.id).then((done) => setIsRound1Done(done));
  }, [user?.id]);

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

  const begin = async () => {
    if (roundType === 'round2') {
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
      };
      const session = await createInterviewSession(request);
      startInterview(
        session.interviewId,
        session.roomName,
        normalizedTargetRole,
        session.serverUrl,
        session.token,
        durationMinutes
      );
      router.push(`/dashboard/interview/session/${session.interviewId}`);
    } catch (error) {
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
        description="Choose your interview track. Practice theoretical system design viva or live coding with IDE."
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
            {roundType === 'round1' && <Check className="h-4 w-4 text-[#D93829]" />}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-stone-400">
            15–20 min voice technical viva covering fundamentals, system architecture, trade-offs, and HR.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!isRound1Done) {
              toast.info('Round 2 is locked. Please complete Round 1 Technical Viva first!');
              return;
            }
            setRoundType('round2');
          }}
          className={`flex flex-col rounded-2xl border p-5 text-left transition-colors ${
            roundType === 'round2'
              ? 'border-[#D93829] bg-[#28201E]'
              : !isRound1Done
              ? 'border-stone-800 bg-[#28201E]/40 opacity-75 cursor-not-allowed'
              : 'border-stone-800 bg-[#28201E]/60 hover:border-stone-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={`grid h-8 w-8 place-items-center rounded-lg border border-stone-800 ${isRound1Done ? 'bg-stone-900 text-stone-200' : 'bg-amber-500/10 text-amber-400'}`}>
                {isRound1Done ? <Code2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </span>
              <div>
                <span className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${isRound1Done ? 'text-stone-500' : 'text-amber-400'}`}>
                  {isRound1Done ? 'Round 2' : 'Round 2 (Locked)'}
                </span>
                <h3 className="text-sm font-bold text-stone-100">DSA + web dev IDE</h3>
              </div>
            </div>
            {isRound1Done && roundType === 'round2' ? (
              <Check className="h-4 w-4 text-[#D93829]" />
            ) : !isRound1Done ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                Finish Round 1 First
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-stone-400">
            {isRound1Done
              ? 'Interactive in-browser code editor testing algorithm efficiency (O(N) vs O(N²)) and architecture.'
              : 'Unlocks after completing Round 1 Technical Viva. Live IDE with benchmark evaluation and test cases.'}
          </p>
        </button>
      </div>

      <section className="rounded-2xl border border-stone-800 bg-[#28201E] p-5 md:p-7">
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
            <div className="grid grid-cols-3 gap-2">
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
          <div role="status" className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-900/40 bg-amber-950/30 px-3.5 py-3 text-xs text-amber-300">
            <Radio className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
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
          <Button
            onClick={() => void begin()}
            disabled={isCreating}
            className="rounded-lg bg-[#D93829] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B]"
          >
            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {roundType === 'round2' ? (
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
        </div>
      </section>
    </div>
  );
}
