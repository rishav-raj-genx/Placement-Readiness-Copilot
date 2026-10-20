'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Bot,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { HireableLogo } from '@/components/brand/hireable-logo';
import { saveToStorage } from '@/lib/storage';

interface IntroSequenceProps {
  open?: boolean;
  onClose?: () => void;
}

interface StepData {
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
}

const INTRO_STEPS: StepData[] = [
  {
    title: 'Stop guessing your readiness.',
    body: 'Hireable evaluates your resume and skills against placement standards, pairing you with mock viva interviews to identify concrete gaps before faculty and recruiter reviews.',
    icon: CheckCircle2,
  },
  {
    title: 'One upload. Full context.',
    body: 'Upload your resume PDF, connect your GitHub, and add your career details. Key projects and skills are parsed to construct your verified candidate profile.',
    icon: FileText,
  },
  {
    title: 'Practice with mock viva sessions.',
    body: 'Participate in structured technical mock interviews tailored to your skill set, complete with timestamped transcript playback and rubric-level scoring.',
    icon: Bot,
  },
  {
    title: 'Review your score and apply.',
    body: 'Track your placement readiness score out of 100, address concrete feedback areas, and discover verified MSOT placement opportunities directly on your feed.',
    icon: Briefcase,
  },
];

export function IntroSequence({ open = true, onClose }: IntroSequenceProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDismiss = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('has_seen_intro', 'true');
    }
    saveToStorage('has_seen_intro', true);
    if (onClose) {
      onClose();
    }
    router.push('/dashboard');
  }, [onClose, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDismiss]);

  const handleFinish = () => {
    localStorage.setItem('has_seen_intro', 'true');
    saveToStorage('has_seen_intro', true);
    if (onClose) {
      onClose();
    }
    router.push('/dashboard');
  };

  const handleNext = () => {
    if (currentStep < INTRO_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  if (!open) return null;

  const current = INTRO_STEPS[currentStep];
  const StepIcon = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4 sm:p-6">
      {/* Blurred Dark Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={handleDismiss}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
      />

      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-4 top-4 z-30 rounded-lg border border-stone-800 bg-stone-900/90 px-3 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:bg-stone-800 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829] sm:right-6 sm:top-6"
      >
        Skip tour
      </button>

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-xl">
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-2xl border border-stone-800 bg-[#28201E] p-6 text-stone-200 shadow-lg shadow-black/50 sm:p-8"
        >
          {/* Top Brand & Step Indicator */}
          <div className="flex items-center justify-between border-b border-stone-800 pb-4">
            <div className="flex items-center gap-2.5">
              <HireableLogo size={26} priority />
              <span className="font-[var(--font-display)] text-sm font-bold tracking-tight text-stone-100">
                Hireable
              </span>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center gap-1.5" aria-label="Tour progress">
              {INTRO_STEPS.map((step, idx) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    idx === currentStep
                      ? 'w-6 bg-[#D93829]'
                      : idx < currentStep
                      ? 'w-2 bg-stone-600'
                      : 'w-2 bg-stone-800'
                  }`}
                  aria-label={`Go to step ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Animated Slide Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="py-5"
            >
              <span className="font-mono text-xs uppercase tracking-wider text-stone-400">
                Step {currentStep + 1} of {INTRO_STEPS.length}
              </span>

              <div className="mt-3 flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-stone-700 bg-stone-800 text-[#D93829]">
                  <StepIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-stone-100 sm:text-xl">
                    {current.title}
                  </h3>
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-stone-300 sm:text-sm">
                {current.body}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Footer Controls */}
          <div className="flex items-center justify-between border-t border-stone-800 pt-4">
            <div>
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:bg-stone-800 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {currentStep < INTRO_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D93829] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
                >
                  <span>Next step</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D93829] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
                >
                  <span>Get started with Hireable</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
