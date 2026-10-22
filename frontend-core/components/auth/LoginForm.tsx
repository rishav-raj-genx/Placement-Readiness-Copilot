'use client';

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Eye, EyeOff, Mail, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from '@/lib/toast';
import { getAuthenticatedDestination } from '@/lib/auth-routing';
import { SegmentedLoader } from '@/components/ui/SegmentedLoader';
import { getAuthErrorMessage } from '@/lib/auth-errors';

interface LoginFormProps {
  onToggleSignUp: () => void;
  redirectTo?: string | null;
}

export function LoginForm({ onToggleSignUp, redirectTo }: LoginFormProps) {
  const router = useRouter();
  const { signIn, isLoading, error, clearError } = useAuthStore();

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isFocusedEmail, setIsFocusedEmail] = useState(false);
  const [isFocusedPassword, setIsFocusedPassword] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const submitLockRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || isLoading) return;
    if (!email.trim() || !password) {
      toast.error('Please enter your email and password');
      return;
    }

    submitLockRef.current = true;
    clearError();
    try {
      await signIn(email.trim(), password);
      const state = useAuthStore.getState();

      if (state.user) {
        setIsRedirecting(true);
        toast.success(isAdminMode ? 'Welcome to Faculty & Admin Portal' : 'Welcome back to Hireable');
        const destination = getAuthenticatedDestination({
          role: state.user.role,
          onboardingCompleted: Boolean(state.user.onboardingCompletedAt),
          requestedPath: redirectTo,
        });
        router.replace(destination);
        router.refresh();
      } else if (state.error) {
        toast.error(state.error);
      }
    } catch (error: unknown) {
      toast.error(getAuthErrorMessage(error, 'sign_in'));
    } finally {
      submitLockRef.current = false;
    }
  };

  if (isRedirecting) {
    return (
      <SegmentedLoader
        message={isAdminMode ? 'Loading administrative portal…' : 'Loading candidate workspace…'}
        subtitle="Verifying credentials…"
        fullScreen
      />
    );
  }

  return (
    <motion.div
      key="login-module"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="w-full max-w-md rounded-2xl border border-stone-800 bg-[#28201E] p-7 text-stone-200 shadow-lg shadow-black/50 sm:p-9"
    >
      {/* Header */}
      <div className="mb-7">
        <div className="inline-flex items-center gap-1.5 rounded border border-stone-700 bg-stone-800 px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider text-stone-300">
          {isAdminMode ? (
            <>
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              <span>Faculty & Admin Portal</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-3.5 w-3.5 text-[#D93829]" />
              <span>Placement Copilot</span>
            </>
          )}
        </div>
        <h2 className="mt-3 font-[var(--font-display)] text-2xl font-bold tracking-tight text-stone-100 sm:text-3xl">
          {isAdminMode ? 'Faculty & Admin Portal' : 'Welcome back'}
        </h2>
        <p className="mt-1.5 text-xs text-stone-400 sm:text-sm">
          {isAdminMode
            ? 'Sign in to manage technical vivas, review transcripts, and post MSOT job listings.'
            : 'Sign in to review your readiness scores and practice mock viva sessions.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Input */}
        <div>
          <label htmlFor="login-email" className="block text-xs font-medium text-stone-300 mb-1.5">
            Email address
          </label>
          <div className="relative">
            <input
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setIsFocusedEmail(true)}
              onBlur={() => setIsFocusedEmail(false)}
              required
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              className="h-11 w-full rounded-lg border border-stone-800 bg-stone-900/90 px-3.5 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-500 focus:border-[#D93829] focus:ring-1 focus:ring-[#D93829]"
              placeholder={isAdminMode ? 'faculty@institution.edu' : 'name@college.edu'}
            />
            <Mail className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-stone-500" />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="login-password" className="text-xs font-medium text-stone-300">
              Password
            </label>
            <button
              type="button"
              onClick={() => toast.info('Password recovery link can be sent to your verified email.')}
              className="text-xs text-stone-400 transition-colors hover:text-stone-200"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setIsFocusedPassword(true)}
              onBlur={() => setIsFocusedPassword(false)}
              required
              autoComplete="current-password"
              className="h-11 w-full rounded-lg border border-stone-800 bg-stone-900/90 px-3.5 pr-10 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-500 focus:border-[#D93829] focus:ring-1 focus:ring-[#D93829]"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-3.5 text-stone-500 hover:text-stone-300"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Primary Login Button */}
        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#D93829] px-4 font-[var(--font-display)] text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Authenticating…</span>
            </>
          ) : (
            <>
              <span>{isAdminMode ? 'Sign in to Portal' : 'Sign in'}</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

      </form>

      {/* Pathway Switcher */}
      <div className="mt-7 border-t border-stone-800 pt-5 text-center space-y-2">
        {isAdminMode ? (
          <div>
            <p className="text-xs text-stone-400">
              Candidate looking for interviews?{' '}
              <button
                type="button"
                onClick={() => setIsAdminMode(false)}
                className="font-medium text-[#D93829] transition-colors hover:underline"
              >
                Candidate Sign in &rarr;
              </button>
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-stone-400">
              New candidate?{' '}
              <button
                type="button"
                onClick={onToggleSignUp}
                className="font-medium text-[#D93829] transition-colors hover:underline"
              >
                Create your account &rarr;
              </button>
            </p>
            <div>
              <button
                type="button"
                onClick={() => setIsAdminMode(true)}
                className="text-[11px] text-stone-400 transition-colors hover:text-stone-200"
              >
                Staff & Faculty Access &rarr;
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default LoginForm;
