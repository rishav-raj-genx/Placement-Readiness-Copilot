'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { HireableLogo } from '@/components/brand/hireable-logo';
import { LoginForm } from './LoginForm';
import { SignUpWizard } from './SignUpWizard';

interface AuthCanvasProps {
  initialMode?: 'login' | 'signup';
  redirectTo?: string | null;
}

export function AuthCanvas({ initialMode = 'login', redirectTo }: AuthCanvasProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0B0F17] text-white">
      {/* Background: Subtle slow-moving radial mesh gradient in electric indigo & cyan */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-0"
        animate={{
          background: [
            'radial-gradient(circle at 20% 30%, rgba(99,102,241,0.18), transparent 50%), radial-gradient(circle at 80% 70%, rgba(6,182,212,0.14), transparent 50%)',
            'radial-gradient(circle at 35% 65%, rgba(99,102,241,0.22), transparent 55%), radial-gradient(circle at 65% 35%, rgba(6,182,212,0.18), transparent 55%)',
            'radial-gradient(circle at 20% 30%, rgba(99,102,241,0.18), transparent 50%), radial-gradient(circle at 80% 70%, rgba(6,182,212,0.14), transparent 50%)',
          ],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
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

      {/* Top Navbar / Brand Anchor */}
      <header className="relative z-30 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="group flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <HireableLogo size={32} withGlow priority />
          <span className="font-[var(--font-display)] text-lg font-bold tracking-tight text-white">
            Hireable
          </span>
        </Link>

        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-white/50 backdrop-blur-md transition-all hover:border-white/20 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Home</span>
        </Link>
      </header>

      {/* Global Auth Layout — The "Split Canvas" */}
      <main className="relative z-10 flex min-h-[calc(100vh-80px)] w-full flex-col lg:flex-row">
        {/* Left Panel (50% width, hidden on mobile): Sticky 3D Glassmorphic Brand Element */}
        <section
          className="relative hidden w-1/2 flex-col items-center justify-center p-12 lg:sticky lg:top-20 lg:flex"
          style={{ perspective: 1200 }}
        >
          {/* Concentric Ambient Glow Rings */}
          <div className="pointer-events-none absolute h-[440px] w-[440px] rounded-full border border-indigo-500/10 bg-gradient-to-tr from-indigo-500/10 to-cyan-500/5 blur-xl" />

          {/* 3D Glassmorphic Hovering Brand Shield with Vertical Sine-Wave Float */}
          <motion.div
            className="relative z-10 flex flex-col items-center rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-10 text-center shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
            animate={{
              y: [-10, 10, -10],
              rotateX: [5, -5, 5],
              rotateY: [-6, 6, -6],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Glowing "H" Emblem */}
            <div className="relative mb-6">
              <div
                className="absolute -inset-4 rounded-3xl opacity-60 blur-xl"
                style={{
                  background: 'radial-gradient(circle, #6366F1, #06B6D4)',
                }}
              />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-white/20 bg-[#0B0F17]/90 shadow-2xl">
                <HireableLogo size={60} withGlow priority />
              </div>
            </div>

            {/* Display Typography */}
            <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight text-white lg:text-4xl">
              Hireable Copilot
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
              The AI readiness platform that verifies your resume, conducts live mock technical vivas, and calculates your definitive placement score.
            </p>

            {/* Live Telemetry Pills */}
            <div className="mt-8 flex flex-col gap-2.5 w-full max-w-xs">
              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-left">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-400" />
                <span className="font-mono text-xs text-white/80">AI 15-Minute Adaptive Viva</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-left">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-400" />
                <span className="font-mono text-xs text-white/80">Unified GitHub & Document Graph</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-left">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="font-mono text-xs text-white/80">MSOT Placement Matching</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Right Panel (50% width on desktop, 100% on mobile): Active Interaction Zone */}
        <section className="flex w-full flex-1 items-center justify-center p-6 sm:p-10 lg:w-1/2 lg:p-12">
          <AnimatePresence mode="wait">
            {mode === 'login' ? (
              <LoginForm
                key="login"
                onToggleSignUp={() => setMode('signup')}
                redirectTo={redirectTo}
              />
            ) : (
              <SignUpWizard
                key="signup"
                onToggleLogin={() => setMode('login')}
              />
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}

export default AuthCanvas;
