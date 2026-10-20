'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  FileText,
  Bot,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { HireableLogo } from '@/components/brand/hireable-logo';
import { saveToStorage } from '@/lib/storage';

interface IntroSequenceProps {
  open?: boolean;
  onClose?: () => void;
}

interface StepData {
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

const INTRO_STEPS: StepData[] = [
  {
    badge: 'Welcome to Hireable',
    title: 'Autonomous Placement Readiness Copilot',
    subtitle: 'From profile analysis to offer letter, fully automated.',
    description:
      'Prepare for top-tier software engineering and tech roles with an intelligent copilot designed to diagnose your skills and simulate real company interview bars.',
    highlights: [
      'Tailored practice plans for FAANG, startups, and high-growth tech',
      'Realistic role-based competency benchmarks',
      'Real-time readiness score progression',
    ],
    icon: Sparkles,
    accentColor: 'from-indigo-500 to-purple-600',
  },
  {
    badge: 'Step 1: Diagnostics',
    title: 'Deep Profile & ATS Extraction',
    subtitle: 'Instant multi-modal candidate assessment.',
    description:
      'Seamlessly upload your Resume PDF and LinkedIn profile. Our parsing engine extracts key technologies, project impact, and GitHub repos to identify your exact skill gaps.',
    highlights: [
      'Automated ATS keyword and gap analysis',
      'GitHub repository audit and project depth verification',
      'Personalized interview quiz tailoring based on your stack',
    ],
    icon: FileText,
    accentColor: 'from-blue-500 to-cyan-500',
  },
  {
    badge: 'Step 2: Simulation',
    title: 'Live AI Voice & Video Mock Interviews',
    subtitle: 'Ultra-low latency conversational practice.',
    description:
      'Experience hyper-realistic technical screeners and system design interviews powered by real-time voice streaming with adaptive questions that push your problem-solving depth.',
    highlights: [
      'Sub-second voice response with realistic interviewer personas',
      'Live audio waveforms and interactive transcript drawer',
      'Instant post-interview scoring across communication and correctness',
    ],
    icon: Bot,
    accentColor: 'from-cyan-500 to-emerald-500',
  },
  {
    badge: 'Step 3: Execution',
    title: 'Smart Job Discovery & Kanban Tracking',
    subtitle: 'Land your dream role faster.',
    description:
      'Match your evaluated readiness score directly against live, verified tech job openings and manage your entire application pipeline through an integrated Kanban board.',
    highlights: [
      'Automated job discovery matched to your target role',
      'Visual application funnel from Applied to Offer',
      'Targeted recommendations to boost your match rate',
    ],
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePosition({ x, y });
  };

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('has_seen_intro', 'true');
    }
    saveToStorage('has_seen_intro', true);
    if (onClose) {
      onClose();
    }
  };

  const handleFinish = () => {
    handleDismiss();
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

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close intro"
            className="absolute right-5 top-5 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

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
                  key={step.badge}
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
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                  <Zap className="h-3 w-3 text-cyan-400" />
                  {current.badge}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-white/30">
                  {currentStep + 1} of {INTRO_STEPS.length}
                </span>
              </div>

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
                  <p className="mt-1 text-sm font-medium text-indigo-300/80">
                    {current.subtitle}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-white/70">
                {current.description}
              </p>

              {/* Highlights */}
              <div className="mt-5 space-y-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                {current.highlights.map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-xs sm:text-sm text-white/80">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Footer Controls */}
          <div
            className="flex items-center justify-between border-t border-white/[0.06] pt-5"
            style={{ transform: 'translateZ(30px)' }}
          >
            <div className="flex items-center gap-2">
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-xs font-medium text-white/40 transition-colors hover:text-white/80 px-2 py-2"
                >
                  Skip Tour
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
