'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Sparkles,
  Bot,
  Zap,
  CheckCircle2,
  Layers,
  BarChart3,
  FileText,
  Play,
  RotateCcw,
} from 'lucide-react';
import { HireableLogo } from '@/components/brand/hireable-logo';
import { IntroSequence } from '@/components/IntroSequence';
import { useAuthStore } from '@/stores/auth-store';

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [showIntro, setShowIntro] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hasSeen = localStorage.getItem('has_seen_intro');
    if (!hasSeen) {
      setShowIntro(true);
    }
  }, []);

  // Avoid hydration mismatch
  if (!mounted) return null;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0B0F17] text-white">
      {/* Background: Subtle animated radial gradients */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-0"
        animate={{
          background: [
            'radial-gradient(circle at 20% 25%, rgba(99,102,241,0.16), transparent 50%), radial-gradient(circle at 80% 75%, rgba(6,182,212,0.12), transparent 50%)',
            'radial-gradient(circle at 35% 60%, rgba(99,102,241,0.20), transparent 55%), radial-gradient(circle at 65% 30%, rgba(6,182,212,0.16), transparent 55%)',
            'radial-gradient(circle at 20% 25%, rgba(99,102,241,0.16), transparent 50%), radial-gradient(circle at 80% 75%, rgba(6,182,212,0.12), transparent 50%)',
          ],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Cybernetic Grid Overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Top Navbar */}
      <header className="relative z-30 flex items-center justify-between border-b border-white/[0.06] bg-[#0B0F17]/70 px-6 py-4.5 backdrop-blur-md sm:px-12">
        <Link href="/" className="group flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <HireableLogo size={32} withGlow priority />
          <span className="font-[var(--font-display)] text-lg font-bold tracking-tight text-white">
            Hireable
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setShowIntro(true)}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-white/60 backdrop-blur-md transition-all hover:border-white/20 hover:text-white"
          >
            <RotateCcw className="h-3 w-3 text-cyan-400" />
            <span className="hidden sm:inline">Product Tour</span>
            <span className="sm:hidden">Tour</span>
          </button>

          {user ? (
            <Link
              href={user.role === 'admin' ? '/admin-dashboard' : '/dashboard'}
              className="rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:opacity-95"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/auth"
                className="text-xs font-medium text-white/70 transition-colors hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/auth?mode=signup"
                className="flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:opacity-95 hover:shadow-indigo-500/35"
              >
                <span>Get Started</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 pt-16 pb-24 sm:pt-24 sm:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300 backdrop-blur-md"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Autonomous Placement Readiness Copilot</span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 font-[var(--font-display)] text-4xl font-extrabold tracking-tight sm:text-6xl sm:leading-[1.12]"
          >
            Ace Your Next Tech Interview with{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-teal-200 bg-clip-text text-transparent">
              Autonomous AI Simulation
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-base sm:text-lg leading-relaxed text-white/65"
          >
            From multi-modal resume analysis to ultra-low latency LiveKit voice mock interviews,
            Hireable continuously benchmarks and refines your placement readiness.
          </motion.p>

          {/* Action CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col items-center justify-center gap-3.5 sm:flex-row"
          >
            <Link
              href="/auth?mode=signup"
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-500/25 transition-all hover:opacity-95 hover:shadow-indigo-500/40 sm:w-auto"
            >
              <span>Start Free Practice</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>

            <button
              type="button"
              onClick={() => setShowIntro(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-medium text-white/80 backdrop-blur-md transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white sm:w-auto"
            >
              <Play className="h-4 w-4 text-cyan-400" />
              <span>Watch 3D Onboarding Tour</span>
            </button>
          </motion.div>

          {/* Metrics bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-14 grid grid-cols-3 divide-x divide-white/[0.08] rounded-2xl border border-white/[0.08] bg-white/[0.02] py-4.5 px-2 backdrop-blur-sm"
          >
            <div className="px-3">
              <div className="text-xl sm:text-2xl font-bold text-white font-[var(--font-display)]">
                94%
              </div>
              <div className="text-[11px] sm:text-xs text-white/50">Confidence Rating</div>
            </div>
            <div className="px-3">
              <div className="text-xl sm:text-2xl font-bold text-cyan-400 font-[var(--font-display)]">
                &lt; 400ms
              </div>
              <div className="text-[11px] sm:text-xs text-white/50">Live Voice Latency</div>
            </div>
            <div className="px-3">
              <div className="text-xl sm:text-2xl font-bold text-indigo-400 font-[var(--font-display)]">
                100%
              </div>
              <div className="text-[11px] sm:text-xs text-white/50">Automated Pipeline</div>
            </div>
          </motion.div>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-24 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7 backdrop-blur-md transition-all hover:border-indigo-500/30 hover:bg-white/[0.04]">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-lg font-bold text-white font-[var(--font-display)]">
              Multi-Modal Profile Parsing
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Instant analysis of Resume PDFs, LinkedIn career trajectories, and GitHub repositories to detect gaps before recruiters do.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7 backdrop-blur-md transition-all hover:border-cyan-500/30 hover:bg-white/[0.04]">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-lg font-bold text-white font-[var(--font-display)]">
              Adaptive Live Interviews
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Conversational voice simulation that reacts dynamically to your logic, challenges edge cases, and provides instant scoring.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7 backdrop-blur-md transition-all hover:border-purple-500/30 hover:bg-white/[0.04]">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-lg font-bold text-white font-[var(--font-display)]">
              Dynamic Readiness Matrix
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Holistic radar tracking your technical depth, communication, and real-time placement probabilities across top tech firms.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-[#070A0F]/60 py-8 px-6 text-center text-xs text-white/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <HireableLogo size={20} />
            <span className="font-semibold text-white/80">Hireable</span>
            <span>&mdash; Autonomous Placement Readiness</span>
          </div>
          <p>&copy; {new Date().getFullYear()} Hireable. All rights reserved.</p>
        </div>
      </footer>

      {/* FTUE 3D Parallax Intro Modal */}
      <AnimatePresence>
        {showIntro && (
          <IntroSequence
            open={showIntro}
            onClose={() => setShowIntro(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
