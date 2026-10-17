'use client';

import type { FC } from 'react';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Brain,
  ArrowRight,
  Target,
  MessagesSquare,
  TrendingUp,
  Sparkles,
  SlidersHorizontal,
  Clock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { OnboardingTrigger } from '@/components/onboarding-trigger';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useAuthStore } from '@/stores/auth-store';
import { useAuthModalStore } from '@/stores/auth-modal-store';
import { toast } from 'sonner';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const steps: {
  icon: FC<{ className?: string }>;
  title: string;
  desc: string;
  examples?: string[];
}[] = [
  {
    icon: Target,
    title: 'Set Your Target & Profile',
    desc: 'Tell us your targeted role and company, then provide the profile materials MSOT needs to personalize your interview.',
    examples: [
      'Your targeted role and company',
      'Your GitHub ID',
      'Your LinkedIn PDF',
      'Your Resume PDF',
    ],
  },
  {
    icon: SlidersHorizontal,
    title: 'Get an Automatic Preparation Plan',
    desc: 'MSOT uses your role and company to automatically build the right preparation plan and quiz for your target interview.',
    examples: [
      'Role-specific interview questions',
      'Company-relevant preparation topics',
      'An automatically personalized quiz',
    ],
  },
  {
    icon: MessagesSquare,
    title: 'Practise Realistic Questions',
    desc: 'Work through an automatically generated quiz aligned with your target role, company, and likely interview expectations.',
    examples: [],
  },
  {
    icon: TrendingUp,
    title: 'Review Feedback and Improve',
    desc: 'Review your performance, identify weak areas, and use targeted practice to improve your interview readiness.',
    examples: [],
  },
];

function HeroSection() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthModalStore((s) => s.open);

  const heroRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const paraRef = useRef<HTMLParagraphElement>(null);
  const btnsRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleStartPrep = () => {
    openAuthModal('/interview/configure');
  };

  useEffect(() => {
    // Set initial hidden state imperatively via GSAP — do NOT use Tailwind opacity-0
    // because it persists after hydration and fights with GSAP's inline styles
    gsap.set(
      [badgeRef.current, h1Ref.current, paraRef.current, btnsRef.current, noteRef.current, cardRef.current],
      { opacity: 0 }
    );

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(badgeRef.current, { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 })
        .fromTo(h1Ref.current, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.75 }, '-=0.3')
        .fromTo(paraRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65 }, '-=0.4')
        .fromTo(btnsRef.current, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, '-=0.35')
        .fromTo(noteRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 }, '-=0.2')
        .fromTo(
          cardRef.current,
          { x: 36, opacity: 0, scale: 0.97 },
          { x: 0, opacity: 1, scale: 1, duration: 0.85, ease: 'power2.out' },
          '-=0.65'
        );
    });

    return () => ctx.revert();
  }, []);

  // Subtle floating animation for the hero card
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const float = gsap.to(el, {
      y: -8,
      duration: 3,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    });
    return () => { float.kill(); };
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-28" ref={heroRef}>
      <div className="grid gap-14 md:grid-cols-2 md:items-center">
        <div className="space-y-7">
          {/* Animated badge — no opacity-0 class, GSAP sets it */}
          <div
            ref={badgeRef}
            className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-3.5 py-1.5 text-xs font-medium text-brand"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Interview Preparation
          </div>

          <h1
            ref={h1Ref}
            className="text-4xl font-semibold leading-[1.12] tracking-tight md:text-[3.25rem]"
          >
            Your Next Interview{' '}
            <span className="relative inline-block">
              <span className="relative z-10">Starts Here.</span>
              <span className="absolute inset-x-0 bottom-1 h-[0.18em] rounded-full bg-brand/25" />
            </span>
          </h1>

          <p
            ref={paraRef}
            className="max-w-md text-lg text-muted-foreground leading-relaxed"
          >
            Practise realistic interviews with AI, strengthen your answers, and
            discover what to improve before the real thing.
          </p>

          <div ref={btnsRef} className="flex flex-col gap-3 sm:flex-row">
            <Button variant="brand" size="lg" className="group" onClick={handleStartPrep}>
              Start Interview Preparation
              <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-foreground/20 hover:border-white hover:bg-black hover:text-white transition-all duration-200"
              onClick={() => useOnboardingStore.getState().openManual()}
            >
              Explore How It Works
            </Button>
          </div>

          <p ref={noteRef} className="text-sm text-muted-foreground">
            Includes 3 free interview sessions. No credit card required.
          </p>
        </div>

        {/* Product Preview Card — no opacity-0 class */}
        <div ref={cardRef} className="relative">
          {/* Glow halo behind card */}
          <div className="absolute -inset-4 rounded-3xl bg-brand/5 blur-2xl" />
          <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Mock Interview &middot; Technical
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
                </span>
                Live Preview
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Question 3 of 8 &middot; React
              </div>
              <h3 className="text-base font-medium leading-snug">
                Explain the difference between useMemo and useCallback. When
                would you use each?
              </h3>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-4 min-h-[110px]">
              <p className="text-sm text-muted-foreground/60 italic">
                Type your answer here...
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                22 minutes remaining
              </div>
              <Button variant="brand" size="sm" className="group" onClick={handleStartPrep}>
                Submit Answer
                <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Button>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      i < 3 ? 'bg-brand' : 'bg-border'
                    }`}
                  />
                ))}
              </div>
              <p className="text-right text-[10px] text-muted-foreground">3 / 8 completed</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


function StepCard({
  icon: Icon,
  title,
  desc,
  examples,
  index,
}: {
  icon: FC<{ className?: string }>;
  title: string;
  desc: string;
  examples?: string[];
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    const line = lineRef.current;
    if (!el || !line) return;

    // Set initial state via GSAP — no Tailwind opacity-0 needed
    gsap.set(el, { opacity: 0, y: 40 });
    gsap.set(line, { scaleX: 0, transformOrigin: 'left' });

    const ctx = gsap.context(() => {
      gsap.to(el, {
        y: 0,
        opacity: 1,
        duration: 0.75,
        delay: index * 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none',
        },
      });

      gsap.to(line, {
        scaleX: 1,
        duration: 0.6,
        delay: index * 0.1 + 0.3,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none',
        },
      });
    });

    return () => ctx.revert();
  }, [index]);

  return (
    <div
      ref={cardRef}
      className="group relative flex h-full min-h-[330px] flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-md"
    >
      {/* Top accent line */}
      <div
        ref={lineRef}
        className="absolute inset-x-0 top-0 h-[2px] bg-brand"
        style={{ transformOrigin: 'left' }}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/8 transition-colors duration-300 group-hover:bg-brand/15">
          <Icon className="h-5 w-5 text-brand" />
        </div>
        <span className="text-3xl font-semibold tracking-tight text-muted-foreground/20 select-none">
          0{index + 1}
        </span>
      </div>

      <div className="mt-7 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">
          Step {index + 1}
        </p>
        <h3 className="text-xl font-semibold leading-tight tracking-tight">{title}</h3>
        <p className="text-sm leading-[1.7] text-muted-foreground">{desc}</p>
      </div>

      <div className="mt-auto border-t border-border pt-5">
        {examples && examples.length > 0 ? (
          <ul className="space-y-2">
            {examples.map((ex) => (
              <li key={ex} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70" />
                {ex}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs font-medium text-muted-foreground">
            Practice with purpose, then use your feedback to keep improving.
          </p>
        )}
      </div>
    </div>
  );
}

function HowItWorksSection() {
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    gsap.set(el, { opacity: 0, y: 24 });
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.75, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
    });
  }, []);

  return (
    <section id="how-it-works" className="border-t border-border bg-muted/20">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div
          ref={headingRef}
          className="mb-12 grid gap-5 md:grid-cols-[0.85fr_1.15fr] md:items-end md:gap-12"
        >
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand">
              A clearer path forward
            </p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              How It Works
            </h2>
          </div>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:justify-self-end">
            Four focused steps to turn your target role into a practical
            interview preparation plan.
          </p>
        </div>

        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:gap-5">
          {steps.map((step, i) => (
            <StepCard key={i} {...step} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthModalStore((s) => s.open);
  const ctaRef = useRef<HTMLDivElement>(null);

  const handleStartPrep = () => {
    openAuthModal('/interview/configure');
  };

  const handleSignIn = () => {
    openAuthModal('/dashboard');
  };

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    gsap.set(el, { opacity: 0, y: 28 });
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
    });
  }, []);

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div
          ref={ctaRef}
          className="relative overflow-hidden space-y-5 rounded-2xl border border-border bg-card p-10 text-center shadow-sm md:p-16"
        >
          {/* Subtle radial glow */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--brand)/0.06),transparent_70%)]" />

          <h2 className="relative text-2xl font-semibold tracking-tight md:text-3xl">
            Ready to practise?
          </h2>
          <p className="relative mx-auto max-w-lg text-muted-foreground leading-relaxed">
            Start your first mock interview in minutes. You get 3 free sessions
            to prepare with confidence.
          </p>
          <div className="relative flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
            <Button variant="brand" size="lg" className="group" onClick={handleStartPrep}>
              Start Interview Preparation
              <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-foreground/20 hover:border-white hover:bg-black hover:text-white transition-all duration-200"
              onClick={handleSignIn}
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthModalStore((s) => s.open);
  const navRef = useRef<HTMLElement>(null);

  // If user is already signed in, they can never visit or view the landing page
  useEffect(() => {
    if (user) {
      router.replace(user.role === 'admin' ? '/admin/dashboard' : '/dashboard');
    }
  }, [user, router]);

  const handleGetStarted = () => {
    openAuthModal('/interview/configure');
  };

  const handleSignIn = () => {
    openAuthModal('/dashboard');
  };

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const trigger = ScrollTrigger.create({
      start: 'top -60',
      onEnter: () => nav.classList.add('nav-scrolled'),
      onLeaveBack: () => nav.classList.remove('nav-scrolled'),
    });

    return () => trigger.kill();
  }, []);

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header
        ref={navRef}
        className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm transition-all duration-300"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-brand" />
            <span className="text-lg font-semibold tracking-tight">MSOT</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="border border-transparent text-muted-foreground hover:border-white hover:bg-black hover:text-white transition-all duration-200"
              onClick={handleSignIn}
            >
              Sign In
            </Button>
            <Button variant="brand" size="sm" className="group" onClick={handleGetStarted}>
              Get Started
              <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </header>

      <HeroSection />
      <HowItWorksSection />
      <CtaSection />

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-brand" />
            <span className="text-sm font-medium">MSOT</span>
            <span className="text-sm text-muted-foreground">
              &mdash; Interview Preparation Platform
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} MSOT. All rights reserved.
          </p>
        </div>
      </footer>

      <OnboardingTrigger />
    </div>
  );
}
