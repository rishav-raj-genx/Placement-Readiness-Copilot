'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, CheckCircle2, GitBranch, Loader2, Lock, Mail, Sparkles, User, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import {
  normalizeGithubUsername,
  signupAccountSchema,
  signupProfileSchema,
  type SignupAccountValues,
  type SignupProfileValues,
  validatePdf,
} from '@/lib/onboarding';
import {
  clearPendingSignup,
  loadPendingSignupDocuments,
  loadPendingSignupDraft,
  savePendingSignupDocuments,
  savePendingSignupDraft,
  type PendingSignupDraft,
} from '@/lib/signup-draft';
import { useAuthStore } from '@/stores/auth-store';
import { LinkedInPdfTooltip } from './LinkedInPdfTooltip';
import { SignupPdfDropzone } from './SignupPdfDropzone';
import { SegmentedLoader } from '@/components/ui/SegmentedLoader';

interface SignUpWizardProps {
  onToggleLogin: () => void;
}

interface AuthenticatedIdentity {
  id: string;
  email: string;
}

interface StoredProfile {
  display_name: string | null;
  target_role: string | null;
  github_username: string | null;
  resume_pdf_path: string | null;
  linkedin_pdf_path: string | null;
}

interface DocumentProgress {
  resume: number;
  linkedin: number;
}

const EMPTY_ACCOUNT: SignupAccountValues = { fullName: '', email: '', password: '' };
const EMPTY_PROFILE: SignupProfileValues = { targetRole: '', github: '' };

const slideVariants: Variants = {
  enter: (direction: number) => ({ x: direction > 0 ? 80 : -80, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1, transition: { type: 'spring', damping: 20, stiffness: 140 } },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.22, ease: 'easeInOut' },
  }),
};

function confirmationRedirectUrl(): string {
  const query = new URLSearchParams({ next: '/auth?mode=signup&resume=1' });
  return `${window.location.origin}/auth/callback?${query.toString()}`;
}

export function SignUpWizard({ onToggleLogin }: SignUpWizardProps) {
  const router = useRouter();
  const hydrate = useAuthStore((state) => state.hydrate);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [identity, setIdentity] = useState<AuthenticatedIdentity | null>(null);
  const [storedProfile, setStoredProfile] = useState<StoredProfile | null>(null);
  const [accountValues, setAccountValues] = useState<SignupAccountValues>(EMPTY_ACCOUNT);
  const [profileValues, setProfileValues] = useState<SignupProfileValues>(EMPTY_PROFILE);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [linkedinFile, setLinkedinFile] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DocumentProgress>({ resume: 0, linkedin: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const accountForm = useForm<SignupAccountValues>({
    resolver: zodResolver(signupAccountSchema),
    defaultValues: EMPTY_ACCOUNT,
    mode: 'onTouched',
  });
  const profileForm = useForm<SignupProfileValues>({
    resolver: zodResolver(signupProfileSchema),
    defaultValues: EMPTY_PROFILE,
    mode: 'onTouched',
  });

  useEffect(() => {
    let active = true;

    const restore = async () => {
      try {
        const [draft, documents] = await Promise.all([
          Promise.resolve(loadPendingSignupDraft()),
          loadPendingSignupDocuments(),
        ]);
        if (!active) return;

        setResumeFile(documents.resume);
        setLinkedinFile(documents.linkedin);

        let authUser: SupabaseUser | null = null;
        if (isSupabaseConfigured) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data } = await supabase.auth.getUser();
            authUser = data.user;
          }
        }
        let profile: StoredProfile | null = null;
        if (authUser) {
          const { data } = await supabase
            .from('profiles')
            .select('display_name, target_role, github_username, resume_pdf_path, linkedin_pdf_path')
            .eq('id', authUser.id)
            .maybeSingle();
          profile = data as StoredProfile | null;
          if (!active) return;
          setIdentity({ id: authUser.id, email: authUser.email ?? draft?.email ?? '' });
          setStoredProfile(profile);
        }

        const nextAccount: SignupAccountValues = {
          fullName: profile?.display_name ?? draft?.displayName ?? '',
          email: authUser?.email ?? draft?.email ?? '',
          password: authUser ? 'confirmed-session' : '',
        };
        const nextProfile: SignupProfileValues = {
          targetRole: profile?.target_role ?? draft?.targetRole ?? '',
          github: profile?.github_username ?? draft?.githubUsername ?? '',
        };

        setAccountValues(nextAccount);
        setProfileValues(nextProfile);
        accountForm.reset(nextAccount);
        profileForm.reset(nextProfile);

        if (authUser) {
          setStep(nextProfile.targetRole && nextProfile.github ? 3 : 2);
        }
      } catch (error) {
        if (active) setSubmissionError(error instanceof Error ? error.message : 'Saved signup state could not be restored.');
      }
    };

    void restore();
    return () => { active = false; };
  }, [accountForm, profileForm]);

  const persistDraft = (account: SignupAccountValues, profile: SignupProfileValues): PendingSignupDraft => {
    const draft = {
      displayName: account.fullName.trim(),
      email: account.email.trim(),
      targetRole: profile.targetRole.trim(),
      githubUsername: normalizeGithubUsername(profile.github),
    };
    savePendingSignupDraft(draft);
    return draft;
  };

  const handleAccountNext = accountForm.handleSubmit((values) => {
    setAccountValues(values);
    persistDraft(values, profileValues);
    setDirection(1);
    setStep(2);
  });

  const handleProfileNext = profileForm.handleSubmit(async (values) => {
    const normalizedValues = { ...values, github: normalizeGithubUsername(values.github) };
    setProfileValues(normalizedValues);
    profileForm.reset(normalizedValues);
    persistDraft(accountValues, normalizedValues);
    await savePendingSignupDocuments({ resume: resumeFile, linkedin: linkedinFile });
    setDirection(1);
    setStep(3);
  });

  const selectDocument = async (kind: 'resume' | 'linkedin', file: File) => {
    const error = validatePdf(file);
    if (kind === 'resume') {
      setResumeError(error);
      if (!error) setResumeFile(file);
    } else {
      setLinkedinError(error);
      if (!error) setLinkedinFile(file);
    }
    if (!error) {
      await savePendingSignupDocuments({
        resume: kind === 'resume' ? file : resumeFile,
        linkedin: kind === 'linkedin' ? file : linkedinFile,
      });
    }
  };

  const handlePrevious = () => {
    setDirection(-1);
    setStep((current) => Math.max(identity ? 2 : 1, current - 1));
  };

  const handleFinalSubmit = async () => {
    setSubmissionError(null);
    const hasResume = Boolean(resumeFile || storedProfile?.resume_pdf_path);
    const hasLinkedIn = Boolean(linkedinFile || storedProfile?.linkedin_pdf_path);
    setResumeError(hasResume ? null : 'Resume PDF is required.');
    setLinkedinError(hasLinkedIn ? null : 'LinkedIn profile PDF is required.');
    if (!hasResume || !hasLinkedIn) return;

    const accountResult = identity
      ? { success: true as const, data: accountValues }
      : signupAccountSchema.safeParse(accountValues);
    const profileResult = signupProfileSchema.safeParse(profileValues);
    if (!accountResult.success || !profileResult.success) {
      setSubmissionError('Review the account and profile steps before continuing.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured. Add its public URL and anon key to frontend-core/.env.local.');
      }

      const draft = persistDraft(accountResult.data, profileResult.data);
      await savePendingSignupDocuments({ resume: resumeFile, linkedin: linkedinFile });

      let activeIdentity = identity;
      if (!activeIdentity) {
        const { data, error } = await supabase.auth.signUp({
          email: draft.email,
          password: accountResult.data.password,
          options: {
            data: { display_name: draft.displayName, full_name: draft.displayName },
            emailRedirectTo: confirmationRedirectUrl(),
          },
        });
        if (error) throw error;
        if (!data.user) throw new Error('Account creation failed because no user was returned.');
        if (!data.session) {
          setConfirmationEmail(draft.email);
          toast.success('Check your email to confirm your account.');
          return;
        }
        activeIdentity = { id: data.user.id, email: data.user.email ?? draft.email };
        setIdentity(activeIdentity);
      }

      const resumePath = `${activeIdentity.id}/resume.pdf`;
      const linkedinPath = `${activeIdentity.id}/linkedin.pdf`;
      setProgress({ resume: resumeFile ? 25 : 100, linkedin: linkedinFile ? 25 : 100 });

      const uploads: Promise<void>[] = [];
      if (resumeFile) {
        uploads.push(supabase.storage.from('candidate-documents').upload(resumePath, resumeFile, {
          upsert: true,
          contentType: 'application/pdf',
        }).then(({ error }) => {
          if (error) throw error;
          setProgress((current) => ({ ...current, resume: 100 }));
        }));
      }
      if (linkedinFile) {
        uploads.push(supabase.storage.from('candidate-documents').upload(linkedinPath, linkedinFile, {
          upsert: true,
          contentType: 'application/pdf',
        }).then(({ error }) => {
          if (error) throw error;
          setProgress((current) => ({ ...current, linkedin: 100 }));
        }));
      }
      await Promise.all(uploads);

      const completedAt = new Date().toISOString();
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: activeIdentity.id,
        email: activeIdentity.email,
        display_name: draft.displayName,
        role: 'student',
        target_role: draft.targetRole,
        github_username: draft.githubUsername,
        resume_pdf_path: storedProfile?.resume_pdf_path && !resumeFile ? storedProfile.resume_pdf_path : resumePath,
        linkedin_pdf_path: storedProfile?.linkedin_pdf_path && !linkedinFile ? storedProfile.linkedin_pdf_path : linkedinPath,
        onboarding_completed_at: completedAt,
        updated_at: completedAt,
      }, { onConflict: 'id' });
      if (profileError) throw profileError;

      await clearPendingSignup();
      setIsSuccess(true);
      toast.success('Your Hireable profile is ready.');
      hydrate();
      void fetch('/api/profile-review/analyze', { method: 'POST' }).catch(() => undefined);
      window.setTimeout(() => {
        router.replace('/dashboard?analysis=processing');
        router.refresh();
      }, 1200);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Registration failed. Your progress is saved; retry when ready.';
      setSubmissionError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <SegmentedLoader
        message="Building your Copilot..."
        subtitle="Opening your verified readiness dashboard..."
        fullScreen
      />
    );
  }

  if (confirmationEmail) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg rounded-3xl border border-cyan-500/30 bg-[#0F1D21]/90 p-10 text-center shadow-[0_0_60px_rgba(6,182,212,0.2)] backdrop-blur-2xl">
        <CheckCircle2 className="mx-auto h-12 w-12 text-cyan-300" />
        <h2 className="mt-6 font-[var(--font-display)] text-2xl font-bold">Confirm your email</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/60">We sent a confirmation link to <strong className="text-white">{confirmationEmail}</strong>. Your form and both PDFs are saved in this browser and will resume after confirmation.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ x: '100vw', scaleX: 0.15, opacity: 0 }}
      animate={{ x: 0, scaleX: 1, opacity: 1 }}
      exit={{ x: '-100vw', scaleX: 0.15, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 110, damping: 16 }}
      className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#101827]/85 p-7 shadow-[0_25px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-9"
    >
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300"><Zap className="h-3 w-3" />PROFILE SYNC</div>
          <span className="font-mono text-xs font-bold text-white/40">STEP {step} OF 3</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((item) => <div key={item} className={`h-1.5 rounded-full ${item <= step ? 'bg-gradient-to-r from-indigo-500 to-cyan-400' : 'bg-white/10'}`} />)}
        </div>
        <h2 className="mt-4 font-[var(--font-display)] text-2xl font-extrabold tracking-tight sm:text-3xl">
          {step === 1 ? 'Create your account' : step === 2 ? 'Role & GitHub identity' : 'Secure document sync'}
        </h2>
        <p className="mt-1 text-xs font-medium text-cyan-300/80">You can replace these details later in profile settings.</p>
      </div>

      <div className="relative min-h-[300px]">
        <AnimatePresence custom={direction} mode="wait">
          {step === 1 && (
            <motion.form key="account" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" onSubmit={handleAccountNext} className="space-y-4">
              <Field label="Full name" error={accountForm.formState.errors.fullName?.message} icon={<User className="h-4 w-4" />}>
                <input {...accountForm.register('fullName')} autoComplete="name" className="auth-input" placeholder="Alex Morgan" />
              </Field>
              <Field label="Email address" error={accountForm.formState.errors.email?.message} icon={<Mail className="h-4 w-4" />}>
                <input {...accountForm.register('email')} type="email" autoComplete="email" className="auth-input" placeholder="alex@college.edu" />
              </Field>
              <Field label="Secure password" error={accountForm.formState.errors.password?.message} icon={<Lock className="h-4 w-4" />}>
                <input {...accountForm.register('password')} type="password" autoComplete="new-password" className="auth-input" placeholder="Minimum 8 characters" />
              </Field>
              <PrimaryButton label="Next: Career goal" />
            </motion.form>
          )}

          {step === 2 && (
            <motion.form key="profile" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" onSubmit={(event) => void handleProfileNext(event)} className="space-y-4">
              {identity && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200"><CheckCircle2 className="mr-2 inline h-4 w-4" />Confirmed account: {identity.email}</div>}
              <Field label="Target role" error={profileForm.formState.errors.targetRole?.message} icon={<Zap className="h-4 w-4" />}>
                <input {...profileForm.register('targetRole')} className="auth-input" placeholder="Frontend Engineer" />
              </Field>
              <Field label="GitHub username or URL" error={profileForm.formState.errors.github?.message} icon={<GitBranch className="h-4 w-4" />}>
                <input {...profileForm.register('github')} autoComplete="off" className="auth-input" placeholder="octocat or github.com/octocat" />
              </Field>
              <div className="flex gap-3 pt-2">
                {!identity && <BackButton onClick={handlePrevious} />}
                <PrimaryButton label="Next: Upload PDFs" />
              </div>
            </motion.form>
          )}

          {step === 3 && (
            <motion.div key="documents" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" className="space-y-4">
              <SignupPdfDropzone label="Resume PDF" description="Drop your resume here, or browse" accent="indigo" file={resumeFile} existingDocument={Boolean(storedProfile?.resume_pdf_path)} error={resumeError} progress={progress.resume} onChange={(file) => void selectDocument('resume', file)} />
              <div>
                <div className="mb-2 flex justify-end"><LinkedInPdfTooltip /></div>
                <SignupPdfDropzone label="LinkedIn profile PDF" description="Drop your LinkedIn export here, or browse" accent="cyan" file={linkedinFile} existingDocument={Boolean(storedProfile?.linkedin_pdf_path)} error={linkedinError} progress={progress.linkedin} onChange={(file) => void selectDocument('linkedin', file)} />
              </div>
              {submissionError && <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">{submissionError}</div>}
              <div className="flex gap-3 pt-2">
                <BackButton onClick={handlePrevious} disabled={isSubmitting} />
                <button type="button" disabled={isSubmitting} onClick={() => void handleFinalSubmit()} className="group flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 py-3.5 text-sm font-bold shadow-[0_0_30px_rgba(16,185,129,0.35)] transition hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50">
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Syncing securely…</> : <><Sparkles className="h-4 w-4" />Create my profile</>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!identity && <div className="mt-6 border-t border-white/10 pt-5 text-center text-xs text-white/50">Already registered? <button type="button" onClick={onToggleLogin} className="font-semibold text-cyan-300 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">Sign in</button></div>}
    </motion.div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Field({ label, error, icon, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-white/70">{label} <span className="text-rose-400">*</span></span>
      <span className="relative block">{children}<span className="pointer-events-none absolute right-4 top-3.5 text-white/30">{icon}</span></span>
      {error && <span role="alert" className="mt-1 block text-xs text-rose-400">{error}</span>}
    </label>
  );
}

function PrimaryButton({ label }: { label: string }) {
  return <button type="submit" className="group mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 py-3.5 text-sm font-bold shadow-[0_0_25px_rgba(99,102,241,0.35)] transition hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">{label}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></button>;
}

function BackButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label="Previous step" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-40"><ArrowLeft className="h-4 w-4" /></button>;
}
