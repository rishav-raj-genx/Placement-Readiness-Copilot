'use client';

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from '@/lib/toast';
import { getAuthenticatedDestination } from '@/lib/auth-routing';
import { SegmentedLoader } from '@/components/ui/SegmentedLoader';
import { getAuthErrorMessage } from '@/lib/auth-errors';

interface LoginFormProps {
  isSignUp?: boolean;
  isStaff?: boolean;
  onToggleStaff?: () => void;
  redirectTo?: string | null;
}

export function LoginForm({
  isSignUp = false,
  isStaff = false,
  onToggleStaff = () => {},
  redirectTo,
}: LoginFormProps) {
  const router = useRouter();
  const { signIn, isLoading, error, clearError } = useAuthStore();

  // Common credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Faculty Sign-Up credentials
  const [fullName, setFullName] = useState('');
  const [facultyCode, setFacultyCode] = useState('');
  const [showFacultyCode, setShowFacultyCode] = useState(false);
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);

  const [isRedirecting, setIsRedirecting] = useState(false);
  const submitLockRef = useRef(false);

  // 1. Candidate or Faculty Sign-In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || isLoading) return;
    if (!email.trim() || !password) {
      toast.error('Please enter your email and password.');
      return;
    }

    submitLockRef.current = true;
    clearError();
    try {
      await signIn(email.trim(), password);
      const state = useAuthStore.getState();

      if (state.user) {
        setIsRedirecting(true);
        toast.success(
          isStaff ? 'Welcome to Faculty & Admin Portal' : 'Welcome back to Hireable'
        );

        const destination = isStaff
          ? redirectTo?.startsWith('/admin')
            ? redirectTo
            : '/admin-interviews'
          : getAuthenticatedDestination({
              role: state.user.role,
              onboardingCompleted: Boolean(state.user.onboardingCompletedAt),
              requestedPath: redirectTo,
            });

        router.replace(destination);
        router.refresh();
      } else if (state.error) {
        toast.error(state.error);
      }
    } catch (err: unknown) {
      toast.error(getAuthErrorMessage(err, 'sign_in'));
    } finally {
      submitLockRef.current = false;
    }
  };

  // 2. Secure Faculty & Admin Registration
  const handleFacultySignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdminSubmitting || isLoading) return;

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedCode = facultyCode.trim();

    if (!trimmedName || !trimmedEmail || !password || !trimmedCode) {
      toast.error('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    setIsAdminSubmitting(true);
    clearError();

    try {
      const response = await fetch('/api/auth/faculty-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: trimmedName,
          email: trimmedEmail,
          password,
          facultyCode: trimmedCode,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
        message?: string;
      };

      if (!response.ok || data.error) {
        const errorMsg = data.error || 'Failed to create faculty account.';
        toast.error(errorMsg);
        return;
      }

      toast.success('Faculty account authorized and created! Logging in…');

      // Authenticate session for newly created admin account
      await signIn(trimmedEmail, password);

      setIsRedirecting(true);
      router.replace('/admin-interviews');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  if (isRedirecting) {
    return (
      <SegmentedLoader
        message={isStaff ? 'Loading administrative portal…' : 'Loading candidate workspace…'}
        subtitle="Verifying credentials…"
        fullScreen
      />
    );
  }

  return (
    <motion.div
      key={`${isSignUp ? 'signup' : 'signin'}-${isStaff ? 'staff' : 'candidate'}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="w-full max-w-md rounded-2xl border border-stone-800 bg-[#28201E] p-7 text-stone-200 shadow-lg shadow-black/50 sm:p-9"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 rounded border border-stone-700 bg-stone-800 px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider text-stone-300">
          {isStaff ? (
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
          {isStaff
            ? isSignUp
              ? 'Create Staff Account'
              : 'Faculty & Admin Portal'
            : 'Welcome back, Candidate'}
        </h2>

        <p className="mt-1.5 text-xs text-stone-400 sm:text-sm">
          {isStaff
            ? isSignUp
              ? 'Register with your institutional credentials and verified MSOT authorization code.'
              : 'Sign in to manage technical vivas, review transcripts, and post MSOT job listings.'
            : 'Sign in to review your readiness scores and practice mock viva sessions.'}
        </p>
      </div>

      {/* Form View: Staff Sign-Up vs Sign-In */}
      {isStaff && isSignUp ? (
        /* State 4: Staff Sign-Up View */
        <form onSubmit={handleFacultySignUp} className="space-y-4">
          {/* Full Name */}
          <div>
            <label htmlFor="admin-name" className="block text-xs font-medium text-stone-300 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <input
                id="admin-name"
                name="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                className="h-11 w-full rounded-lg border border-stone-800 bg-stone-900/90 px-3.5 pl-10 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-500 focus:border-[#D93829] focus:ring-1 focus:ring-[#D93829]"
                placeholder="Dr. Sarah Mitchell"
              />
              <User className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-stone-500" />
            </div>
          </div>

          {/* Institutional Email */}
          <div>
            <label htmlFor="admin-email" className="block text-xs font-medium text-stone-300 mb-1.5">
              Institutional Email Address
            </label>
            <div className="relative">
              <input
                id="admin-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                className="h-11 w-full rounded-lg border border-stone-800 bg-stone-900/90 px-3.5 pl-10 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-500 focus:border-[#D93829] focus:ring-1 focus:ring-[#D93829]"
                placeholder="faculty@institution.edu"
              />
              <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-stone-500" />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="admin-password" className="block text-xs font-medium text-stone-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="h-11 w-full rounded-lg border border-stone-800 bg-stone-900/90 px-3.5 pr-10 pl-10 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-500 focus:border-[#D93829] focus:ring-1 focus:ring-[#D93829]"
                placeholder="••••••••"
              />
              <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-stone-500" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-stone-500 hover:text-stone-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Faculty Authorization Code */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="admin-code" className="text-xs font-medium text-stone-300">
                Faculty Authorization Code
              </label>
              <span className="text-[10px] text-stone-500 font-mono">Issued by MSOT</span>
            </div>
            <div className="relative">
              <input
                id="admin-code"
                name="facultyCode"
                type={showFacultyCode ? 'text' : 'password'}
                value={facultyCode}
                onChange={(e) => setFacultyCode(e.target.value)}
                required
                autoComplete="off"
                className="h-11 w-full rounded-lg border border-stone-800 bg-stone-900/90 px-3.5 pr-10 pl-10 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-500 focus:border-[#D93829] focus:ring-1 focus:ring-[#D93829]"
                placeholder="••••••••••••"
              />
              <KeyRound className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-stone-500" />
              <button
                type="button"
                onClick={() => setShowFacultyCode(!showFacultyCode)}
                className="absolute right-3.5 top-3.5 text-stone-500 hover:text-stone-300"
              >
                {showFacultyCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Lava Red Submit Button */}
          <button
            type="submit"
            disabled={isAdminSubmitting}
            aria-busy={isAdminSubmitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 font-[var(--font-display)] text-xs font-semibold text-white shadow-md shadow-red-950/40 transition-colors hover:bg-red-700 active:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAdminSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Authorizing &amp; Creating Account…</span>
              </>
            ) : (
              <>
                <span>Create Faculty Account</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      ) : (
        /* State 1 & State 2: Sign-In View (Candidate or Staff) */
        <form onSubmit={handleSignIn} className="space-y-4">
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
                required
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                className="h-11 w-full rounded-lg border border-stone-800 bg-stone-900/90 px-3.5 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-500 focus:border-[#D93829] focus:ring-1 focus:ring-[#D93829]"
                placeholder={isStaff ? 'faculty@institution.edu' : 'name@college.edu'}
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
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 font-[var(--font-display)] text-xs font-semibold text-white shadow-md shadow-red-950/40 transition-colors hover:bg-red-700 active:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Authenticating…</span>
              </>
            ) : (
              <>
                <span>{isStaff ? 'Sign in to Portal' : 'Sign In'}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* Persona Footer Toggle: Exactly ONE link that flips isStaff */}
      <div className="mt-6 border-t border-stone-800/80 pt-4 text-center">
        <button
          type="button"
          onClick={onToggleStaff}
          className="text-xs font-medium text-stone-400 transition-colors hover:text-stone-200 focus-visible:outline-none"
        >
          {!isSignUp && !isStaff && 'Staff Sign In →'}
          {!isSignUp && isStaff && 'Candidate Sign In →'}
          {isSignUp && isStaff && 'Create Candidate Account →'}
        </button>
      </div>
    </motion.div>
  );
}

export default LoginForm;
