'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  FileText,
  Bot,
  Briefcase,
  ArrowRight,
  ArrowLeft,
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
  accentColor: string;
}

const INTRO_STEPS: StepData[] = [
  {
    title: 'Stop Guessing Your Readiness.',
    body: "Rejections hurt when you don't know why. Hireable is your Placement Copilot. We analyze your entire profile and put you through actual AI mock interviews to tell you exactly where you stand before the real HR does.",
    icon: Sparkles,
    accentColor: 'from-indigo-500 to-purple-600',
  },
  {
    title: 'One Drop. Full Context.',
    body: 'No more repetitive form filling. Drop your Resume PDF, link your GitHub, and upload your LinkedIn export. We parse the data instantly and build your master candidate profile.',
    icon: FileText,
    accentColor: 'from-blue-500 to-cyan-500',
  },
  {
    title: 'Face the AI Interviewer.',
    body: "Enter the voice studio. A live AI agent conducts a 15-minute technical mock interview tailored exactly to your resume's tech stack. It listens, adapts, asks dynamic follow-ups, and tests your depth.",
    icon: Bot,
    accentColor: 'from-cyan-500 to-emerald-500',
  },
  {
    title: 'Know Your Score. Get the Job.',
    body: 'Get a definitive Placement Readiness Score (out of 100). Review your exact weaknesses, fix them, and let our engine match you with MSOT-approved jobs and targeted internships with 1-click applications.',
    icon: Briefcase,
    accentColor: 'from-purple-500 to-pink-500',
  },
];

export function IntroSequence({ open = true, onClose }: IntroSequenceProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // 3D Parallax state
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePosition({ x, y });
  };

  const handleFinish = () => {
    localStorage.setItem('has_seen_intro', 'true');
    saveToStorage('has_seen_intro', true);
    if (onClose) {
      onClose();
    }
    router.push('/auth?mode=signup');
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

  // Parallax rotation values (subtle, high-end feel)
  const rotateX = isHovered ? -mousePosition.y * 12 : 0;
  const rotateY = isHovered ? mousePosition.x * 12 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Blurred Dark Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={handleDismiss}
        className="fixed inset-0 bg-[#070A0F]/80 backdrop-blur-xl"
      />

      <button
        type="button"
        onClick={() => {
          localStorage.setItem('has_seen_intro', 'true');
          router.push('/dashboard');
        }}
        className="absolute right-4 top-4 z-30 rounded-full border border-white/15 bg-[#0B0F17]/90 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-xl transition-colors hover:border-white/30 hover:bg-white/10 sm:right-6 sm:top-6"
      >
        Skip Tour
      </button>

      {/* 3D Perspective Container */}
      <div
        className="relative z-10 w-full max-w-2xl"
        style={{ perspective: 1200 }}
      >
        <motion.div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            setIsHovered(false);
            setMousePosition({ x: 0, y: 0 });
          }}
          animate={{
            rotateX,
            rotateY,
            scale: 1,
            y: 0,
            opacity: 1,
          }}
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{
            type: 'spring',
            stiffness: 260,
            damping: 24,
          }}
          style={{
            transformStyle: 'preserve-3d',
          }}
          className="relative rounded-2xl border border-white/10 bg-[#0B0F17]/95 p-7 sm:p-9 shadow-[0_25px_60px_-15px_rgba(99,102,241,0.35)] backdrop-blur-2xl overflow-hidden"
        >
          {/* Dynamic 3D Ambient Spotlight */}
          <div
            className="pointer-events-none absolute -inset-px rounded-2xl opacity-60 transition-opacity duration-300"
            style={{
              background: `radial-gradient(600px circle at ${(mousePosition.x + 0.5) * 100}% ${(mousePosition.y + 0.5) * 100}%, rgba(99,102,241,0.18), transparent 45%)`,
            }}
          />

          {/* Top Brand & Step Indicator */}
          <div
            className="flex items-center justify-between border-b border-white/[0.06] pb-5"
            style={{ transform: 'translateZ(30px)' }}
          >
            <div className="flex items-center gap-2.5">
              <HireableLogo size={28} withGlow priority />
              <span className="font-[var(--font-display)] text-sm font-bold tracking-tight text-white">
                Hireable
              </span>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center gap-1.5">
              {INTRO_STEPS.map((step, idx) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep
                      ? 'w-6 bg-gradient-to-r from-indigo-500 to-cyan-400'
                      : idx < currentStep
                      ? 'w-2 bg-indigo-500/40'
                      : 'w-2 bg-white/10'
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="py-6"
              style={{ transform: 'translateZ(45px)' }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-white/30">
                {currentStep + 1} of {INTRO_STEPS.length}
              </span>

              <div className="mt-4 flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${current.accentColor} shadow-lg shadow-indigo-500/20`}
                >
                  <StepIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                    {current.title}
                  </h3>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-white/70">
                {current.body}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Footer Controls */}
          <div
            className="flex items-center justify-between border-t border-white/[0.06] pt-5"
            style={{ transform: 'translateZ(30px)' }}
          >
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {currentStep < INTRO_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:opacity-95 hover:shadow-indigo-500/40"
                >
                  <span>Next Step</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:opacity-95 hover:shadow-indigo-500/50"
                >
                  <span>Get Started with Hireable</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
