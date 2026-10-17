'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Target,
  SlidersHorizontal,
  MessagesSquare,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  Check,
  Brain,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useAuthStore } from '@/stores/auth-store';
import { useAuthModalStore } from '@/stores/auth-modal-store';

interface Screen {
  icon: React.ElementType;
  heading: string;
  description: string;
}

const screens: Screen[] = [
  {
    icon: Brain,
    heading: 'Prepare for Your Next Interview with Confidence',
    description:
      'Build a focused interview preparation plan around your target role, company, and skills. Practise, review your feedback, and identify where to improve.',
  },
  {
    icon: Target,
    heading: 'Start with Your Career Goal & Profile',
    description:
      'Tell us your targeted goal, targeted role, and company. Then provide your GitHub ID, Resume PDF, and LinkedIn PDF.',
  },
  {
    icon: SlidersHorizontal,
    heading: 'Your Preparation Is Personalized Automatically',
    description:
      'MSOT uses your target role and company to build the preparation plan and quiz for you. No topic selection is required.',
  },
  {
    icon: MessagesSquare,
    heading: 'Practise Before the Real Interview',
    description:
      'Answer questions selected for your preparation goals and build your problem-solving and communication skills.',
  },
  {
    icon: TrendingUp,
    heading: 'Understand Your Performance',
    description:
      'Review your results, identify weaker areas, and use targeted practice to prepare more effectively.',
  },
  {
    icon: Sparkles,
    heading: 'Your Next Interview Starts Here',
    description:
      'Tell us your target role and company, then let MSOT create your personalized quiz and preparation plan.',
  },
];

const step1Benefits = [
  'Role-focused preparation',
  'Personalized practice topics',
  'Feedback to guide improvement',
];

const step2Details = [
  'Your targeted goal',
  'Your targeted role',
  'Your targeted company',
  'Your GitHub ID',
  'Your Resume PDF',
  'Your LinkedIn PDF',
];

const step2Examples = [
  'Career goal and target role',
  'Target company preparation',
  'Profile materials for a personalized interview',
];

const step3Examples = [
  'Data Structures and Algorithms',
  'Web Development',
  'Core Computer Science',
  'Databases',
  'AI and Machine Learning',
  'Behavioral Questions',
];

const finalSteps = [
  'Share your target role and company',
  'Get an automatic preparation plan',
  'Practise your personalized quiz',
  'Review your results',
];

export function OnboardingModal() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { isOpen, isManualOpen, close, complete, dismiss } = useOnboardingStore();
  const [step, setStep] = useState(0);

  const totalSteps = screens.length;
  const isLast = step === totalSteps - 1;
  const current = screens[step];
  const Icon = current.icon;

  const handleSkip = useCallback(() => {
    dismiss(user?.id);
    setStep(0);
  }, [dismiss, user?.id]);

  const handleNext = useCallback(() => {
    if (isLast) {
      complete(user?.id);
      setStep(0);
      if (user?.role === 'admin') {
        router.push('/admin/dashboard');
      } else if (user) {
        router.push('/interview/configure');
      } else {
        close();
        useAuthModalStore.getState().open('/interview/configure');
      }
    } else {
      setStep((s) => s + 1);
    }
  }, [isLast, complete, user, router, close]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (isManualOpen) {
        close();
        setStep(0);
      } else {
        dismiss(user?.id);
        setStep(0);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogTitle className="sr-only">MSOT Onboarding Guide</DialogTitle>
        <DialogDescription className="sr-only">
          A quick tour of how MSOT helps you prepare for interviews.
        </DialogDescription>

        {/* Header with step indicator */}
        <div className="flex items-center border-b border-border px-6 py-3 shrink-0">
          <span className="text-xs font-medium text-muted-foreground">
            {step + 1} of {totalSteps}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 w-full bg-muted shrink-0">
          <div
            className="h-full bg-brand transition-all duration-300 ease-out"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-6 py-6 flex-1">
          {/* Icon */}
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted/50">
            <Icon className="h-6 w-6 text-brand" />
          </div>

          {/* Heading */}
          <h2 className="text-xl font-semibold leading-snug tracking-tight mb-2">
            {current.heading}
          </h2>

          {/* Description */}
          <p className="text-sm leading-relaxed text-muted-foreground mb-4">
            {current.description}
          </p>

          {/* Screen-specific content */}
          {step === 0 && (
            <ul className="space-y-2">
              {step1Benefits.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-brand shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                {step2Details.map((d) => (
                  <div key={d} className="flex items-center gap-2 text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
                    {d}
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Examples
                </p>
                {step2Examples.map((ex) => (
                  <p key={ex} className="text-xs text-muted-foreground">
                    {ex}
                  </p>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {step3Examples.map((ex) => (
                  <span
                    key={ex}
                    className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {ex}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Your role and company determine the preparation focus and quiz questions automatically.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Mock Interview &middot; Technical
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  Preview
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Question 3 of 8 &middot; React</div>
                <p className="text-sm font-medium leading-snug">
                  Explain the difference between useMemo and useCallback.
                </p>
              </div>
              <div className="rounded-md border border-border bg-card p-3 min-h-[60px]">
                <p className="text-xs text-muted-foreground italic">Type your answer here...</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  22 minutes remaining
                </div>
                <span className="text-xs font-medium text-brand">Submit Answer</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Illustrative preview only — no interview is started.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Overall Score</span>
                  <span className="text-2xl font-semibold text-brand">78</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border bg-card p-2">
                    <p className="text-xs text-muted-foreground">Strongest</p>
                    <p className="text-xs font-medium text-success">React, JavaScript</p>
                  </div>
                  <div className="rounded-md border border-border bg-card p-2">
                    <p className="text-xs text-muted-foreground">Weak Areas</p>
                    <p className="text-xs font-medium text-brand">Algorithms</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Sample feedback shown for illustration. Actual feedback is generated after you complete a mock interview.
              </p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-2">
              {finalSteps.map((s, i) => (
                <div key={s} className="flex items-center gap-3 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand shrink-0">
                    {i + 1}
                  </span>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
            )}
            {step === 0 && (
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                Skip Tour
              </Button>
            )}
            {isLast && user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  complete(user.id);
                  setStep(0);
                  router.push(user.role === 'admin' ? '/admin/dashboard' : '/dashboard');
                }}
              >
                Explore the Dashboard
              </Button>
            )}
          </div>
          <Button variant="brand" size="sm" onClick={handleNext}>
            {isLast ? (
              <>
                Start Preparing
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </>
            ) : step === 0 ? (
              <>
                Let&apos;s Get Started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
