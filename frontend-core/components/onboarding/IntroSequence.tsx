'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Linkedin,
  Github,
  Code2,
  Sliders,
  Target,
  Bot,
  Mic,
  Briefcase,
  Rocket,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Layers,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';
import { HireableLogo } from '@/components/brand/hireable-logo';
import { saveToStorage } from '@/lib/storage';

export interface IntroSequenceProps {
  open?: boolean;
  onClose?: () => void;
}

interface StepContent {
  stepNumber: number;
  badge: string;
  title: string;
  headline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

const ONBOARDING_STEPS: StepContent[] = [
  {
    stepNumber: 1,
    badge: 'Step 1 of 5 • Profile Intake',
    title: 'Build Your Profile',
    headline: 'Provide your core professional evidence to start.',
    description:
      'Initialize your autonomous placement audit by uploading your resume PDF and connecting your developer credentials. Our evaluation engine cross-references your ATS formatting, GitHub commit activity, and LeetCode problem-solving rating before faculty reviews.',
    icon: FileText,
    accentColor: '#D93829',
  },
  {
    stepNumber: 2,
    badge: 'Step 2 of 5 • Customization',
    title: 'Configure Your Target Role',
    headline: 'Calibrate your interview experience to your ambitions.',
    description:
      'Customize your preparation path to align with specific career milestones. Select your target technical discipline, fine-tune rubric weights across communication, architecture, and DSA, and calibrate difficulty to match campus and off-campus placement standards.',
    icon: Sliders,
    accentColor: '#EA580C',
  },
  {
    stepNumber: 3,
    badge: 'Step 3 of 5 • The Interview',
    title: 'Two-Round AI Evaluation',
    headline: 'Experience newly upgraded dual-stage technical interviews.',
    description:
      'Rehearse under real exam conditions with our two-round assessment pipeline. Begin with an adaptive oral Technical Viva exploring your project decisions and systems fundamentals, followed by a live Coding Round in Monaco IDE with automated test cases.',
    icon: Bot,
    accentColor: '#D93829',
  },
  {
    stepNumber: 4,
    badge: 'Step 4 of 5 • Job Portal & Tracker',
    title: 'Discover & Track Opportunities',
    headline: 'Explore curated job listings with a Kanban application board.',
    description:
      'Discover verified placement listings matched to your readiness score. Organize and move each application seamlessly through our Kanban board tracker across Saved, Applied, Shortlisted, Interview, Offer, and Rejected stages.',
    icon: Briefcase,
    accentColor: '#F59E0B',
  },
  {
    stepNumber: 5,
    badge: 'Step 5 of 5 • Usage Limits',
    title: 'Start Your Journey',
    headline: '3 complimentary complete rounds to benchmark your readiness.',
    description:
      'You receive 3 free complete interview evaluations (including both Technical Viva and Coding IDE rounds) to test your placement readiness. For ongoing multi-round rehearsals and unlimited diagnostic access, a subscription model is available thereafter.',
    icon: Rocket,
    accentColor: '#D93829',
  },
];

export function IntroSequence({ open = true, onClose }: IntroSequenceProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  // 3D Hover Physics state
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Subtle 3D tilt: max 5 degrees for a crisp, physical feel
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;

    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseEnter = (): void => {
    setIsHovered(true);
  };

  const handleMouseLeave = (): void => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  };

  const handleDismiss = useCallback((): void => {
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
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        handleDismiss();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStep < ONBOARDING_STEPS.length - 1) {
          setCurrentStep((prev) => prev + 1);
        } else {
          handleDismiss();
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentStep > 0) {
          setCurrentStep((prev) => prev - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, handleDismiss]);

  const handleNext = (): void => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = (): void => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  if (!open) return null;

  const step = ONBOARDING_STEPS[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8 font-sans">
      {/* Texture: Global SVG film grain pattern overlay at 0.05 opacity */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-5"
        aria-hidden="true"
      >
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="introFilmGrain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="3"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#introFilmGrain)" />
        </svg>
      </div>

      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={handleDismiss}
        className="fixed inset-0 bg-stone-950/80 backdrop-blur-md"
      />

      {/* Floating Skip Tour button */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-4 top-4 z-30 inline-flex items-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900/90 px-3 py-1.5 text-xs font-medium text-stone-300 shadow-md shadow-black/40 transition-colors hover:bg-stone-800 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 sm:right-6 sm:top-6"
      >
        <span>Skip tour</span>
        <X className="h-3.5 w-3.5 text-stone-500" />
      </button>

      {/* 3D Perspective Modal Wrapper */}
      <div
        className="relative z-10 w-full max-w-3xl"
        style={{ perspective: 1000 }}
      >
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `perspective(1000px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg)`,
            transition: isHovered
              ? 'transform 0.08s ease-out'
              : 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="relative overflow-hidden rounded-2xl border border-stone-800 bg-stone-900 p-6 text-stone-200 shadow-2xl shadow-black/60 sm:p-8"
        >
          {/* Header & Step Tracker */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <HireableLogo size={28} priority />
              <div>
                <p className="font-sans text-sm font-bold tracking-tight text-stone-100">
                  Placement Readiness Copilot
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">
                  Autonomous Placement Rehearsal Engine
                </p>
              </div>
            </div>

            {/* Stepper Progress Pill Tracker (Enters from right) */}
            <motion.div
              key={`progress-${currentStep}`}
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-1.5"
              aria-label="Modal steps"
            >
              {ONBOARDING_STEPS.map((s, idx) => (
                <button
                  key={s.stepNumber}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep
                      ? 'w-7 bg-red-600'
                      : idx < currentStep
                      ? 'w-2.5 bg-orange-600'
                      : 'w-2 bg-stone-800 hover:bg-stone-700'
                  }`}
                  aria-label={`Go to step ${idx + 1}`}
                />
              ))}
            </motion.div>
          </div>

          {/* Staggered Modal Step Content */}
          <AnimatePresence mode="wait">
            <div key={currentStep} className="py-6">
              {/* STAGGER 1: Top Icon / Visual Header (Slides in from Top) */}
              <motion.div
                initial={{ opacity: 0, y: -24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.35,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.04,
                }}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-stone-800 bg-stone-950 text-red-600 shadow-md shadow-black/40">
                    <StepIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="inline-block font-mono text-[11px] font-semibold uppercase tracking-wider text-orange-600">
                      {step.badge}
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-stone-100 sm:text-2xl">
                      {step.title}
                    </h2>
                  </div>
                </div>

                <span className="hidden font-mono text-xs font-semibold text-stone-500 sm:inline-block">
                  {step.stepNumber} / 5
                </span>
              </motion.div>

              {/* Main Content Grid: Left Text + Right Interactive Visual */}
              <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:items-center">
                {/* STAGGER 3: Text (Title / Headline / Description) (Slides in from Below) */}
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: [0.16, 1, 0.3, 1],
                    delay: 0.16,
                  }}
                  className="space-y-3 lg:col-span-7"
                >
                  <p className="text-sm font-semibold text-stone-200 sm:text-base">
                    {step.headline}
                  </p>
                  <p className="text-xs leading-relaxed text-stone-400 sm:text-sm">
                    {step.description}
                  </p>
                </motion.div>

                {/* STAGGER 2: Side Elements / Visual Mockup (Slides in from Right) */}
                <motion.div
                  initial={{ opacity: 0, x: 28 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: [0.16, 1, 0.3, 1],
                    delay: 0.12,
                  }}
                  className="lg:col-span-5"
                >
                  {/* Step 1 Visual: Profile Intake Highlights */}
                  {currentStep === 0 && (
                    <div className="rounded-xl border border-stone-800 bg-stone-950 p-4 space-y-2.5 shadow-md shadow-black/40">
                      <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                          Candidate Dossier
                        </span>
                        <span className="font-mono text-[10px] text-orange-600 font-bold">
                          4 Core Inputs
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-900/60 p-2 text-xs">
                          <span className="flex items-center gap-2 text-stone-200">
                            <FileText className="h-3.5 w-3.5 text-red-600" /> Resume (PDF)
                          </span>
                          <span className="font-mono text-[10px] text-stone-400">ATS Verified</span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-900/60 p-2 text-xs">
                          <span className="flex items-center gap-2 text-stone-200">
                            <Linkedin className="h-3.5 w-3.5 text-orange-600" /> LinkedIn URL
                          </span>
                          <span className="font-mono text-[10px] text-stone-400">Profile Sync</span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-900/60 p-2 text-xs">
                          <span className="flex items-center gap-2 text-stone-200">
                            <Github className="h-3.5 w-3.5 text-stone-200" /> GitHub Link
                          </span>
                          <span className="font-mono text-[10px] text-stone-400">Repo Audit</span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-900/60 p-2 text-xs">
                          <span className="flex items-center gap-2 text-stone-200">
                            <Code2 className="h-3.5 w-3.5 text-amber-500" /> LeetCode ID
                          </span>
                          <span className="font-mono text-[10px] text-stone-400">DSA Rating</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2 Visual: Target Role Configuration */}
                  {currentStep === 1 && (
                    <div className="rounded-xl border border-stone-800 bg-stone-950 p-4 space-y-3 shadow-md shadow-black/40">
                      <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                          Target Track
                        </span>
                        <span className="font-mono text-[10px] text-orange-600 font-bold">
                          Calibrated
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="rounded-lg border border-red-600/40 bg-red-600/10 p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-stone-100 flex items-center gap-1.5">
                              <Target className="h-3.5 w-3.5 text-red-600" /> Full Stack Architect
                            </span>
                            <span className="rounded bg-red-600 px-1.5 py-0.2 font-mono text-[9px] font-bold text-white">
                              ACTIVE
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-stone-400">
                            Focus: System design, React/Node internals &amp; algorithmic scaling
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-2 text-stone-300">
                            <span className="block text-[10px] font-mono text-stone-500">SENIORITY</span>
                            <span>Campus / SDE-1</span>
                          </div>
                          <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-2 text-stone-300">
                            <span className="block text-[10px] font-mono text-stone-500">RUBRIC MODE</span>
                            <span>Standard 100pt</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3 Visual: Two-Round AI Evaluation with Mandated SVG Gradient Path */}
                  {currentStep === 2 && (
                    <div className="rounded-xl border border-stone-800 bg-stone-950 p-4 space-y-3 shadow-md shadow-black/40">
                      <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                          Evaluation Flow
                        </span>
                        <span className="font-mono text-[10px] text-red-600 font-bold">
                          2 Rounds
                        </span>
                      </div>

                      <div className="relative space-y-2">
                        {/* Round 1 Card */}
                        <div className="rounded-lg border border-stone-800 bg-stone-900/70 p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 font-semibold text-stone-200">
                              <Mic className="h-3.5 w-3.5 text-orange-600" /> Round 1: Technical Viva
                            </span>
                            <span className="font-mono text-[10px] text-orange-600">Live Voice</span>
                          </div>
                          <p className="mt-1 text-[11px] text-stone-400">
                            Architecture, fundamentals &amp; theory verification
                          </p>
                        </div>

                        {/* Mandated SVG connecting path transitioning smoothly from Ember Orange to Lava Red */}
                        <div className="flex justify-center py-0.5">
                          <svg
                            className="h-7 w-28"
                            viewBox="0 0 112 28"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                          >
                            <defs>
                              <linearGradient
                                id="lavaEmberTransition"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop offset="0%" stopColor="#EA580C" />
                                <stop offset="100%" stopColor="#D93829" />
                              </linearGradient>
                            </defs>
                            <path
                              d="M 56 0 C 56 14, 56 14, 56 28"
                              stroke="url(#lavaEmberTransition)"
                              strokeWidth="2.5"
                              strokeDasharray="4 3"
                            />
                            <circle cx="56" cy="26" r="2.5" fill="#D93829" />
                          </svg>
                        </div>

                        {/* Round 2 Card */}
                        <div className="rounded-lg border border-stone-800 bg-stone-900/70 p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 font-semibold text-stone-200">
                              <Code2 className="h-3.5 w-3.5 text-red-600" /> Round 2: Coding IDE
                            </span>
                            <span className="font-mono text-[10px] text-red-600">Monaco IDE</span>
                          </div>
                          <p className="mt-1 text-[11px] text-stone-400">
                            Live problem solving, test suite &amp; complexity analysis
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 4 Visual: Kanban Tracker Preview */}
                  {currentStep === 3 && (
                    <div className="rounded-xl border border-stone-800 bg-stone-950 p-4 space-y-3 shadow-md shadow-black/40">
                      <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                          Application Tracker
                        </span>
                        <span className="font-mono text-[10px] text-amber-500 font-bold">
                          Kanban Board
                        </span>
                      </div>

                      {/* 6 Kanban columns preview */}
                      <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                        {[
                          { label: 'Saved', count: 4, color: 'text-stone-400 border-stone-800' },
                          { label: 'Applied', count: 3, color: 'text-stone-300 border-stone-800' },
                          { label: 'Shortlisted', count: 2, color: 'text-amber-500 border-amber-500/30' },
                          { label: 'Interview', count: 1, color: 'text-orange-600 border-orange-600/30' },
                          { label: 'Offer', count: 1, color: 'text-red-600 border-red-600/30' },
                          { label: 'Rejected', count: 0, color: 'text-stone-500 border-stone-800' },
                        ].map((col) => (
                          <div
                            key={col.label}
                            className={`rounded-lg border bg-stone-900/60 p-2 text-center ${col.color}`}
                          >
                            <span className="block truncate font-bold">{col.label}</span>
                            <span className="font-mono text-xs">{col.count}</span>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-2 text-[11px] text-stone-400 flex items-center justify-between">
                        <span>Drag &amp; drop cards between columns</span>
                        <span className="text-stone-300 font-medium">Auto-sync</span>
                      </div>
                    </div>
                  )}

                  {/* Step 5 Visual: Usage Limits (3 Free Complete Rounds) */}
                  {currentStep === 4 && (
                    <div className="rounded-xl border border-stone-800 bg-stone-950 p-4 space-y-3 shadow-md shadow-black/40">
                      <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                          Readiness Allowance
                        </span>
                        <span className="font-mono text-[10px] text-red-600 font-bold">
                          Ready to Launch
                        </span>
                      </div>

                      <div className="rounded-lg border border-red-600/40 bg-red-600/10 p-3 text-center">
                        <span className="font-mono text-2xl font-black text-stone-100">
                          3 Rounds Free
                        </span>
                        <p className="mt-0.5 text-xs text-orange-400 font-medium">
                          Full 2-Round AI Evaluations Included
                        </p>
                      </div>

                      <ul className="space-y-1.5 text-xs text-stone-300">
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                          <span>3 complete Technical Viva + Coding IDE rounds</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                          <span>Unlimited Resume ATS audit &amp; GitHub verification</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                          <span>Full access to Job Portal &amp; Kanban tracker</span>
                        </li>
                      </ul>
                    </div>
                  )}
                </motion.div>
              </div>
            </div>
          </AnimatePresence>

          {/* Footer Controls */}
          <div className="flex items-center justify-between border-t border-stone-800/80 pt-5">
            <div>
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900 px-3.5 py-2 text-xs font-semibold text-stone-300 shadow-md shadow-black/40 transition-colors hover:bg-stone-800 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>
              ) : (
                <div />
              )}
            </div>

            <div className="flex items-center gap-3">
              {currentStep < ONBOARDING_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D93829] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-black/40 transition-colors hover:bg-[#C22F21] active:bg-[#AB281B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                >
                  <span>Next Step</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D93829] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-black/40 transition-colors hover:bg-[#C22F21] active:bg-[#AB281B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                >
                  <span>Start Your Journey</span>
                  <Rocket className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
