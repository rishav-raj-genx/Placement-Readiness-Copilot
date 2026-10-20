'use client';

import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
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
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#1a1310] text-stone-200">
      {/* Top Navbar / Brand Anchor */}
      <header className="relative z-30 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="group flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <HireableLogo size={30} priority />
          <span className="font-[var(--font-display)] text-base font-bold tracking-tight text-stone-100">
            Hireable
          </span>
        </Link>

        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900/80 px-3 py-1.5 text-xs font-medium text-stone-400 transition-colors hover:border-stone-700 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Home</span>
        </Link>
      </header>

      {/* Global Auth Layout */}
      <main className="relative z-10 flex min-h-[calc(100vh-80px)] w-full flex-col lg:flex-row">
        {/* Left Panel: Static Architectural Brand Element */}
        <section className="relative hidden w-1/2 flex-col items-center justify-center p-12 lg:flex">
          <div className="relative z-10 flex w-full max-w-md flex-col items-center rounded-2xl border border-stone-800 bg-[#28201E] p-8 text-center shadow-lg shadow-black/50 sm:p-10">
            {/* Emblem */}
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-xl border border-stone-700 bg-stone-900/90 shadow-none">
              <HireableLogo size={48} priority />
            </div>

            {/* Display Typography */}
            <h1 className="font-[var(--font-display)] text-2xl font-bold tracking-tight text-stone-100 sm:text-3xl">
              Placement Copilot
            </h1>
            <p className="mt-2.5 max-w-sm text-xs leading-relaxed text-stone-400 sm:text-sm">
              The readiness workspace that reviews your resume, conducts structured mock technical vivas, and calculates your verified placement score.
            </p>

            {/* Telemetry Pills */}
            <div className="mt-7 flex w-full max-w-xs flex-col gap-2.5">
              <div className="flex items-center gap-2.5 rounded-lg border border-stone-800 bg-stone-900/80 px-3.5 py-2 text-left">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D93829]" />
                <span className="font-mono text-xs text-stone-300">15-minute adaptive technical viva</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-stone-800 bg-stone-900/80 px-3.5 py-2 text-left">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D93829]" />
                <span className="font-mono text-xs text-stone-300">Unified GitHub and resume graph</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-stone-800 bg-stone-900/80 px-3.5 py-2 text-left">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D93829]" />
                <span className="font-mono text-xs text-stone-300">Official placement matching</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Panel: Active Interaction Zone */}
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
