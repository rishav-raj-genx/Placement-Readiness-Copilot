'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/page-header';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { useLiveKitInterviewStore } from '@/stores/livekit-interview-store';
import { createInterviewSession } from '@/lib/livekit-session';
import { RoleCombobox } from '@/components/interview/RoleCombobox';
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
    <div className="space-y-2">
      <Label>
        {label}
        {hint && <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span>}
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

  const [targetRole, setTargetRole] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('entry_level');
  const [companyType, setCompanyType] = useState<CompanyType>('other');
  const [targetCompany, setTargetCompany] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');

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

  const begin = async () => {
    if (!user || !targetRole.trim() || topics.length === 0) {
      toast.error('Add a target role and at least one focus topic.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const request: LiveKitSessionRequest = {
        studentId: user.id,
        targetRole: targetRole.trim(),
        topics,
        focusAreas: topics,
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
        targetRole.trim(),
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
        title="Interview Studio"
        description="Your profile evidence is already connected. Tune the session and begin when ready."
      />
      <section className="glass-panel rounded-2xl p-5 md:p-7">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Target Role with Searchable Combobox */}
          <Field label="Target role">
            <RoleCombobox value={targetRole} onChange={setTargetRole} />
          </Field>

          {/* Target Company */}
          <Field label="Target company" hint="Optional">
            <Input
              value={targetCompany}
              onChange={(event) => setTargetCompany(event.target.value)}
              placeholder="e.g. Stripe, Google, Startup"
            />
          </Field>

          {/* Experience Level */}
          <Field label="Experience level">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
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
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
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
          <Label>Focus topics</Label>
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
              placeholder="Add a topic (e.g. Distributed Systems, React, LeetCode Hard)"
            />
            <Button variant="outline" type="button" onClick={addTopic}>
              <Plus className="h-4 w-4" />
              <span className="sr-only">Add topic</span>
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {topics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => removeTopic(topic)}
                className="inline-flex items-center rounded-full bg-indigo-500/15 px-3 py-1.5 text-xs text-indigo-100 hover:bg-indigo-500/25 transition-colors"
              >
                {topic}
                <X className="ml-1.5 h-3 w-3" />
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
                      ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-100 font-semibold'
                      : 'border-white/10 text-muted-foreground hover:border-white/20'
                  }`}
                >
                  {difficulty === item && <Check className="mr-1 inline h-3 w-3" />}
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
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    durationMinutes === minutes
                      ? 'border-violet-400/40 bg-violet-500/15 text-violet-100 font-semibold'
                      : 'border-white/10 text-muted-foreground hover:border-white/20'
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
              placeholder="e.g. Focus on concurrency tradeoffs, ask challenging follow-up questions, and evaluate system scalability."
            />
          </Field>
        </div>

        {createError && (
          <p role="alert" className="mt-5 text-sm text-red-300">
            {createError}
          </p>
        )}

        {/* Action Controls */}
        <div className="mt-7 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Resume, LinkedIn PDF, GitHub, and skills come from your unified profile.
          </p>
          <Button onClick={() => void begin()} disabled={isCreating}>
            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Begin interview
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
