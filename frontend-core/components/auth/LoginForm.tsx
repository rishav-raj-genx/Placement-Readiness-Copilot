'use client';

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Eye, EyeOff, Lock, Mail, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
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
        toast.success('Welcome back to Hireable!');
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
        message="Building your Copilot..."
        subtitle="Loading candidate workspace..."
        fullScreen
      />
    );
  }

  return (
    <motion.div
      key="login-module"
      initial={{ y: '-100vh', rotateX: 15, opacity: 0 }}
      animate={{ y: 0, rotateX: 0, opacity: 1 }}
      exit={{ y: '100vh', opacity: 0, transition: { duration: 0.35, ease: 'easeIn' } }}
      transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
      className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101827]/80 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:p-10"
    >
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
          <Sparkles className="h-3 w-3" />
          <span>PLACEMENT COPILOT</span>
        </div>
        <h2 className="mt-3 font-[var(--font-display)] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Welcome back
        </h2>
        <p className="mt-2 text-sm text-white/50">
          Sign in to review your readiness scores and practice AI mock vivas.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Floating Label Email Input */}
        <div className="relative">
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
              className="peer w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 pb-2.5 pt-6 text-sm text-white outline-none transition-all placeholder:text-transparent focus:border-indigo-500 focus:bg-white/[0.06] focus:ring-2 focus:ring-indigo-500/50"
              placeholder="name@example.com"
            />
            <label
              htmlFor="login-email"
              className={`pointer-events-none absolute left-4 transition-all duration-200 ${
                isFocusedEmail || email
                  ? 'top-2 text-[10px] font-semibold text-indigo-400'
                  : 'top-4 text-sm text-white/40'
              }`}
            >
              Email address
            </label>
            <Mail className="pointer-events-none absolute right-4 top-4 h-4 w-4 text-white/30" />
          </div>
        </div>

        {/* Floating Label Password Input */}
        <div className="relative">
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
              className="peer w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 pb-2.5 pt-6 text-sm text-white outline-none transition-all placeholder:text-transparent focus:border-indigo-500 focus:bg-white/[0.06] focus:ring-2 focus:ring-indigo-500/50"
              placeholder="••••••••"
            />
            <label
              htmlFor="login-password"
              className={`pointer-events-none absolute left-4 transition-all duration-200 ${
                isFocusedPassword || password
                  ? 'top-2 text-[10px] font-semibold text-indigo-400'
                  : 'top-4 text-sm text-white/40'
              }`}
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-4 text-white/40 hover:text-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Forgot password */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => toast.info('Password recovery link can be sent to your verified email.')}
            className="text-xs font-medium text-white/40 transition-colors hover:text-white/80"
          >
            Forgot Password?
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-400">
            {error}
          </div>
        )}

        {/* Primary Login Button */}
        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 py-3.5 font-[var(--font-display)] text-sm font-bold text-white shadow-[0_0_25px_rgba(99,102,241,0.4)] transition-all hover:scale-[1.01] hover:shadow-[0_0_35px_rgba(99,102,241,0.6)] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>

      {/* Subtle Toggle: New here? Build your profile */}
      <div className="mt-8 text-center border-t border-white/10 pt-6">
        <p className="text-xs text-white/50">
          New here?{' '}
          <button
            type="button"
            onClick={onToggleSignUp}
            className="font-semibold text-cyan-400 transition-colors hover:text-cyan-300 hover:underline"
          >
            Build your profile &rarr;
          </button>
        </p>
      </div>
    </motion.div>
  );
}
