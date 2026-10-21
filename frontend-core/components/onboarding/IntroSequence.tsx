'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
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
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { HireableLogo } from '@/components/brand/hireable-logo';
import { useAuthStore } from '@/stores/auth-store';
import { setTourCompleted } from '@/lib/tour-storage';
import { loadPendingSignupDraft, savePendingSignupDraft } from '@/lib/signup-draft';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';

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
  imageAsset: string;
  accentColor: string;
}

interface TargetRoleOption {
  id: string;
  title: string;
  focus: string;
  seniority: string;
  rubric: string;
}

const TARGET_ROLE_OPTIONS: TargetRoleOption[] = [
  {
    id: 'full-stack',
    title: 'Full Stack Engineer',
    focus: 'System design, React/Node internals & algorithmic scaling',
    seniority: 'Campus / SDE-1',
    rubric: 'Standard 100pt',
  },
  {
    id: 'backend',
    title: 'Backend Systems Engineer',
    focus: 'Distributed architectures, microservices, databases & concurrency',
    seniority: 'SDE-1 / Graduate',
    rubric: 'Architecture Focus (100pt)',
  },
  {
    id: 'frontend',
    title: 'Frontend / UI Engineer',
    focus: 'Next.js architecture, Web Vitals, CSS systems & state machines',
    seniority: 'SDE-1 / Product Track',
    rubric: 'UI/UX Fidelity (100pt)',
  },
  {
    id: 'generalist',
    title: 'Software Engineer (Generalist)',
    focus: 'Core data structures, OOP paradigms & algorithmic complexity',
    seniority: 'Campus Core',
    rubric: 'LeetCode & Theory (100pt)',
  },
  {
    id: 'devops',
    title: 'DevOps & Cloud Engineer',
    focus: 'CI/CD orchestration, Docker/K8s, Linux kernel & cloud resilience',
    seniority: 'SDE-1 Infrastructure',
    rubric: 'Systems & Reliability (100pt)',
  },
  {
    id: 'ai-ml',
    title: 'AI / Machine Learning Engineer',
    focus: 'Python runtime, LLM fine-tuning, embeddings & inference optimization',
    seniority: 'SDE-1 Emerging Tech',
    rubric: 'ML Systems (100pt)',
  },
];

const ONBOARDING_STEPS: StepContent[] = [
  {
    stepNumber: 1,
    badge: 'Step 1 of 5 • Profile Intake',
    title: 'Build Your Profile',
    headline: 'Provide your core professional evidence to start.',
    description:
      'Initialize your autonomous placement audit by uploading your resume PDF or DOCX and connecting your developer credentials. Our evaluation engine cross-references your ATS formatting, GitHub commit activity, and LeetCode problem-solving rating before faculty reviews.',
    imageAsset: '/onboarding/step1-profile.svg',
    accentColor: '#D93829',
  },
  {
    stepNumber: 2,
    badge: 'Step 2 of 5 • Customization',
    title: 'Configure Your Target Role',
    headline: 'Calibrate your interview experience to your ambitions.',
    description:
      'Customize your preparation path to align with specific career milestones. Select your target technical discipline, fine-tune rubric weights across communication, architecture, and DSA, and calibrate difficulty to match campus and off-campus placement standards.',
    imageAsset: '/onboarding/step2-role.svg',
    accentColor: '#EA580C',
  },
  {
    stepNumber: 3,
    badge: 'Step 3 of 5 • The Interview',
    title: 'Two-Round AI Evaluation',
    headline: 'Experience newly upgraded dual-stage technical interviews.',
    description:
      'Rehearse under real exam conditions with our two-round assessment pipeline. Begin with an adaptive oral Technical Viva exploring your project decisions and systems fundamentals, followed by a live Coding Round in Monaco IDE with automated test cases.',
    imageAsset: '/onboarding/step3-interview.svg',
    accentColor: '#D93829',
  },
  {
    stepNumber: 4,
    badge: 'Step 4 of 5 • Job Portal & Tracker',
    title: 'Discover & Track Opportunities',
    headline: 'Explore curated job listings with a Kanban application board.',
    description:
      'Discover verified placement listings matched to your readiness score. Organize and move each application seamlessly through our Kanban board tracker across Saved, Applied, Shortlisted, Interview, Offer, and Rejected stages.',
    imageAsset: '/onboarding/step4-tracker.svg',
    accentColor: '#F59E0B',
  },
  {
    stepNumber: 5,
    badge: 'Step 5 of 5 • Usage Limits',
    title: 'Start Your Journey',
    headline: '3 complimentary complete rounds to benchmark your readiness.',
    description:
      'You receive 3 free complete interview evaluations (including both Technical Viva and Coding IDE rounds) to test your placement readiness. For ongoing multi-round rehearsals and unlimited diagnostic access, a subscription model is available thereafter.',
    imageAsset: '/onboarding/step5-launch.svg',
    accentColor: '#D93829',
  },
];

export function IntroSequence({ open = true, onClose }: IntroSequenceProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [mounted, setMounted] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Target Role functional state initialized from user profile or pending draft
  const [targetRole, setTargetRole] = useState<string>(() => {
    return user?.targetRole || loadPendingSignupDraft()?.targetRole || 'Full Stack Engineer';
  });
  const [customRoleInput, setCustomRoleInput] = useState<string>('');
  const [isEditingCustomRole, setIsEditingCustomRole] = useState<boolean>(false);

  // 3D Spring Physics for natural cursor-driven rotation with mechanical inertia
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Mechanical spring config for smooth inertial deceleration
  const springConfig = { stiffness: 240, damping: 22, mass: 0.5 };
  const rotateX = useSpring(mouseY, springConfig);
  const rotateY = useSpring(mouseX, springConfig);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update target role if authenticated user profile hydrates
  useEffect(() => {
    if (user?.targetRole) {
      setTargetRole(user.targetRole);
    }
  }, [user?.targetRole]);

  const handleRoleSelect = useCallback((selectedTitle: string) => {
    setTargetRole(selectedTitle);
    setIsEditingCustomRole(false);

    // 1. Sync to pending signup draft
    const existingDraft = loadPendingSignupDraft() || {
      displayName: user?.displayName || '',
      email: user?.email || '',
      githubUsername: user?.githubUsername || '',
      targetRole: selectedTitle,
    };
    savePendingSignupDraft({ ...existingDraft, targetRole: selectedTitle });

    // 2. If authenticated user, persist to database and auth store
    if (user?.id) {
      if (isSupabaseConfigured) {
        void supabase
          .from('profiles')
          .update({ target_role: selectedTitle })
          .eq('id', user.id);
      }
      useAuthStore.setState((prev) => ({
        user: prev.user ? { ...prev.user, targetRole: selectedTitle } : null,
      }));
    }
  }, [user]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Max 5 degrees subtle tilt
    const tiltX = ((y - centerY) / centerY) * -5;
    const tiltY = ((x - centerX) / centerX) * 5;

    mouseY.set(tiltX);
    mouseX.set(tiltY);
  };

  const handleMouseLeave = (): void => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleDismiss = useCallback((): void => {
    void setTourCompleted(user?.id);
    if (onClose) {
      onClose();
    }
    router.push('/dashboard');
  }, [onClose, router, user?.id]);

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

  if (!open || !mounted) return null;

  const step = ONBOARDING_STEPS[currentStep];
  const activeRoleConfig = TARGET_ROLE_OPTIONS.find((r) => r.title === targetRole) || {
    id: 'custom',
    title: targetRole,
    focus: 'Tailored discipline curriculum & algorithmic calibration',
    seniority: 'Campus / SDE-1',
    rubric: 'Customized 100pt',
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8 font-sans">
      {/* Texture: Global SVG film grain pattern overlay at 0.04 opacity */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-4"
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
        className="fixed inset-0 bg-[#1a1310]/85 backdrop-blur-md"
      />

      {/* Floating Skip Tour button */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-4 top-4 z-30 inline-flex items-center gap-1.5 rounded-lg border border-[#382D2A] bg-[#1a1310]/95 px-3 py-1.5 text-xs font-medium text-stone-300 shadow-elevation transition-colors hover:bg-[#28201E] hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829] sm:right-6 sm:top-6"
      >
        <span>Skip tour</span>
        <X className="h-3.5 w-3.5 text-stone-400" />
      </button>

      {/* 3D Perspective Modal Wrapper */}
      <div
        className="relative z-10 w-full max-w-3xl"
        style={{ perspective: 1000 }}
      >
        <motion.div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            rotateX,
            rotateY,
            transformPerspective: 1000,
            transformStyle: 'preserve-3d',
          }}
          className="relative overflow-hidden rounded-2xl border border-[#382D2A] bg-[#28201E] p-6 text-stone-200 shadow-modal sm:p-8"
        >
          {/* Header & Step Tracker */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#382D2A] pb-4">
            <div className="flex items-center gap-2.5">
              <HireableLogo size={28} priority />
              <div>
                <p className="font-sans text-sm font-bold tracking-tight text-stone-100">
                  Placement Readiness Copilot
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-stone-400">
                  Autonomous Placement Rehearsal Engine
                </p>
              </div>
            </div>

            {/* Stepper Progress Indicator: Strict sequence with NO arbitrary jumping ahead */}
            <div
              className="flex items-center gap-1.5"
              role="status"
              aria-label={`Step ${currentStep + 1} of 5`}
            >
              {ONBOARDING_STEPS.map((s, idx) => (
                <div
                  key={s.stepNumber}
                  role="presentation"
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep
                      ? 'w-7 bg-[#D93829]'
                      : idx < currentStep
                      ? 'w-2.5 bg-[#EA580C]'
                      : 'w-2 bg-[#382D2A]'
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>

          {/* Staggered Modal Step Content */}
          <AnimatePresence mode="wait">
            <div key={currentStep} className="py-6">
              {/* STAGGER 1: Top Image Asset / Visual Header (Slides in from Top with Spring Physics) */}
              <motion.div
                initial={{ opacity: 0, y: -32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 280,
                  damping: 22,
                  mass: 0.8,
                }}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#382D2A] bg-[#1a1310] p-1.5 shadow-elevation">
                    <Image
                      src={step.imageAsset}
                      alt={step.title}
                      width={44}
                      height={44}
                      priority
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div>
                    <span className="inline-block font-mono text-[11px] font-semibold uppercase tracking-wider text-[#EA580C]">
                      {step.badge}
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-stone-100 sm:text-2xl font-sans">
                      {step.title}
                    </h2>
                  </div>
                </div>

                <span className="hidden font-mono text-xs font-semibold text-stone-400 sm:inline-block">
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

                {/* STAGGER 2: Side Elements / Visual Control (Slides in from Right) */}
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
                    <div className="rounded-xl border border-[#382D2A] bg-[#1a1310] p-4 space-y-2.5 shadow-elevation">
                      <div className="flex items-center justify-between border-b border-[#382D2A] pb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                          Candidate Dossier
                        </span>
                        <span className="font-mono text-[10px] text-[#EA580C] font-bold">
                          4 Core Inputs
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-lg border border-[#382D2A] bg-[#28201E]/60 p-2 text-xs">
                          <span className="flex items-center gap-2 text-stone-200">
                            <FileText className="h-3.5 w-3.5 text-[#D93829]" /> Resume (PDF / DOCX)
                          </span>
                          <span className="font-mono text-[10px] text-stone-400">ATS Verified</span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-[#382D2A] bg-[#28201E]/60 p-2 text-xs">
                          <span className="flex items-center gap-2 text-stone-200">
                            <Linkedin className="h-3.5 w-3.5 text-[#EA580C]" /> LinkedIn Profile
                          </span>
                          <span className="font-mono text-[10px] text-stone-400">Profile Sync</span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-[#382D2A] bg-[#28201E]/60 p-2 text-xs">
                          <span className="flex items-center gap-2 text-stone-200">
                            <Github className="h-3.5 w-3.5 text-stone-200" /> GitHub Repository
                          </span>
                          <span className="font-mono text-[10px] text-stone-400">Repo Audit</span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-[#382D2A] bg-[#28201E]/60 p-2 text-xs">
                          <span className="flex items-center gap-2 text-stone-200">
                            <Code2 className="h-3.5 w-3.5 text-[#F59E0B]" /> LeetCode Handle
                          </span>
                          <span className="font-mono text-[10px] text-stone-400">DSA Rating</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2 Visual: Functional Target Role Configuration Control */}
                  {currentStep === 1 && (
                    <div className="rounded-xl border border-[#382D2A] bg-[#1a1310] p-4 space-y-3 shadow-elevation">
                      <div className="flex items-center justify-between border-b border-[#382D2A] pb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 font-semibold flex items-center gap-1.5">
                          <Sliders className="h-3 w-3 text-[#EA580C]" /> Calibrate Target Track
                        </span>
                        <span className="font-mono text-[10px] text-[#D93829] font-bold">
                          ACTIVE STATE
                        </span>
                      </div>

                      {/* Interactive Role Selector Dropdown */}
                      <div className="space-y-1.5">
                        <label htmlFor="target-role-select" className="block font-mono text-[10px] uppercase text-stone-400">
                          Select Technical Discipline
                        </label>
                        <select
                          id="target-role-select"
                          value={isEditingCustomRole ? 'custom' : targetRole}
                          onChange={(e) => {
                            if (e.target.value === 'custom') {
                              setIsEditingCustomRole(true);
                            } else {
                              handleRoleSelect(e.target.value);
                            }
                          }}
                          className="w-full rounded-lg border border-[#382D2A] bg-[#28201E] px-3 py-2 text-xs text-stone-100 outline-none transition-colors focus:border-[#D93829] focus:ring-1 focus:ring-[#D93829]"
                        >
                          {TARGET_ROLE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.title} className="bg-[#28201E] text-stone-100">
                              {opt.title}
                            </option>
                          ))}
                          <option value="custom" className="bg-[#28201E] text-stone-100">
                            Custom Role...
                          </option>
                        </select>
                      </div>

                      {/* Custom Role Input Field if selected */}
                      {isEditingCustomRole && (
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={customRoleInput}
                            onChange={(e) => setCustomRoleInput(e.target.value)}
                            placeholder="Enter custom target role..."
                            className="flex-1 rounded-lg border border-[#382D2A] bg-[#28201E] px-3 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:border-[#D93829] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (customRoleInput.trim()) {
                                handleRoleSelect(customRoleInput.trim());
                              }
                            }}
                            className="rounded-lg bg-[#D93829] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21]"
                          >
                            Apply
                          </button>
                        </div>
                      )}

                      {/* Active Calibrated Card Preview */}
                      <div className="rounded-lg border border-[#D93829]/40 bg-[#D93829]/10 p-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-stone-100 flex items-center gap-1.5 truncate">
                            <Target className="h-3.5 w-3.5 text-[#D93829] shrink-0" />
                            <span className="truncate">{activeRoleConfig.title}</span>
                          </span>
                          <span className="shrink-0 rounded bg-[#D93829] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
                            CALIBRATED
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-stone-400">
                          Focus: {activeRoleConfig.focus}
                        </p>
                      </div>

                      {/* Calibrated Rubric & Seniority Tags */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-lg border border-[#382D2A] bg-[#28201E]/60 p-2 text-stone-300">
                          <span className="block text-[10px] font-mono text-stone-400">SENIORITY</span>
                          <span className="font-medium text-stone-200">{activeRoleConfig.seniority}</span>
                        </div>
                        <div className="rounded-lg border border-[#382D2A] bg-[#28201E]/60 p-2 text-stone-300">
                          <span className="block text-[10px] font-mono text-stone-400">RUBRIC MODE</span>
                          <span className="font-medium text-stone-200">{activeRoleConfig.rubric}</span>
                        </div>
                      </div>

                      {/* Synchronized state notice */}
                      <p className="font-mono text-[10px] text-stone-400 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-[#EA580C]" />
                        <span>Synchronized with placement audit profile</span>
                      </p>
                    </div>
                  )}

                  {/* Step 3 Visual: Two-Round AI Evaluation with Mandated SVG Gradient Path */}
                  {currentStep === 2 && (
                    <div className="rounded-xl border border-[#382D2A] bg-[#1a1310] p-4 space-y-3 shadow-elevation">
                      <div className="flex items-center justify-between border-b border-[#382D2A] pb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                          Evaluation Flow
                        </span>
                        <span className="font-mono text-[10px] text-[#D93829] font-bold">
                          2 Rounds
                        </span>
                      </div>

                      <div className="relative space-y-2">
                        {/* Round 1 Card */}
                        <div className="rounded-lg border border-[#382D2A] bg-[#28201E]/70 p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 font-semibold text-stone-200">
                              <Mic className="h-3.5 w-3.5 text-[#EA580C]" /> Round 1: Technical Viva
                            </span>
                            <span className="font-mono text-[10px] text-[#EA580C]">Live Voice</span>
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
                        <div className="rounded-lg border border-[#382D2A] bg-[#28201E]/70 p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 font-semibold text-stone-200">
                              <Code2 className="h-3.5 w-3.5 text-[#D93829]" /> Round 2: Coding IDE
                            </span>
                            <span className="font-mono text-[10px] text-[#D93829]">Monaco IDE</span>
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
                    <div className="rounded-xl border border-[#382D2A] bg-[#1a1310] p-4 space-y-3 shadow-elevation">
                      <div className="flex items-center justify-between border-b border-[#382D2A] pb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                          Application Tracker
                        </span>
                        <span className="font-mono text-[10px] text-[#F59E0B] font-bold">
                          Kanban Board
                        </span>
                      </div>

                      {/* 6 Kanban columns preview */}
                      <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                        {[
                          { label: 'Saved', count: 4, color: 'text-stone-400 border-[#382D2A]' },
                          { label: 'Applied', count: 3, color: 'text-stone-300 border-[#382D2A]' },
                          { label: 'Shortlisted', count: 2, color: 'text-[#F59E0B] border-[#F59E0B]/30' },
                          { label: 'Interview', count: 1, color: 'text-[#EA580C] border-[#EA580C]/30' },
                          { label: 'Offer', count: 1, color: 'text-[#D93829] border-[#D93829]/30' },
                          { label: 'Rejected', count: 0, color: 'text-stone-500 border-[#382D2A]' },
                        ].map((col) => (
                          <div
                            key={col.label}
                            className={`rounded-lg border bg-[#28201E]/60 p-2 text-center ${col.color}`}
                          >
                            <span className="block truncate font-bold">{col.label}</span>
                            <span className="font-mono text-xs">{col.count}</span>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-lg border border-[#382D2A] bg-[#28201E]/40 p-2 text-[11px] text-stone-400 flex items-center justify-between">
                        <span>Drag &amp; drop cards between columns</span>
                        <span className="text-stone-300 font-medium">Auto-sync</span>
                      </div>
                    </div>
                  )}

                  {/* Step 5 Visual: Usage Limits (3 Free Complete Rounds) */}
                  {currentStep === 4 && (
                    <div className="rounded-xl border border-[#382D2A] bg-[#1a1310] p-4 space-y-3 shadow-elevation">
                      <div className="flex items-center justify-between border-b border-[#382D2A] pb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                          Readiness Allowance
                        </span>
                        <span className="font-mono text-[10px] text-[#D93829] font-bold">
                          Ready to Launch
                        </span>
                      </div>

                      <div className="rounded-lg border border-[#D93829]/40 bg-[#D93829]/10 p-3 text-center">
                        <span className="font-mono text-2xl font-black text-stone-100">
                          3 Rounds Free
                        </span>
                        <p className="mt-0.5 text-xs text-[#EA580C] font-medium">
                          Full 2-Round AI Evaluations Included
                        </p>
                      </div>

                      <ul className="space-y-1.5 text-xs text-stone-300">
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-[#EA580C] shrink-0" />
                          <span>3 complete Technical Viva + Coding IDE rounds</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-[#EA580C] shrink-0" />
                          <span>Unlimited Resume ATS audit &amp; GitHub verification</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-[#EA580C] shrink-0" />
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
          <div className="flex items-center justify-between border-t border-[#382D2A] pt-5">
            <div>
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#382D2A] bg-[#1a1310] px-3.5 py-2 text-xs font-semibold text-stone-300 shadow-elevation transition-colors hover:bg-[#28201E] hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
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
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D93829] px-5 py-2.5 text-xs font-bold text-white shadow-elevation transition-colors hover:bg-[#C22F21] active:bg-[#AB281B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
                >
                  <span>Next Step</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D93829] px-5 py-2.5 text-xs font-bold text-white shadow-elevation transition-colors hover:bg-[#C22F21] active:bg-[#AB281B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
                >
                  <span>Start Your Journey</span>
                  <Rocket className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
