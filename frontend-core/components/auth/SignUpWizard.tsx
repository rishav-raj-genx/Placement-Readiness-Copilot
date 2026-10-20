'use client';

import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, CheckCircle2, GitBranch, Loader2, Lock, Mail, User, ShieldCheck } from 'lucide-react';
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
import { getAuthErrorMessage } from '@/lib/auth-errors';

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
  enter: (direction: number) => ({ x: direction > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.18, ease: 'easeOut' } },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
    transition: { duration: 0.15, ease: 'easeIn' },
  }),
};

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
  const submissionLockRef = useRef(false);

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

        if (authUser?.email) {
          setIdentity({ id: authUser.id, email: authUser.email });
          setStep(2);

          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, target_role, github_username, resume_pdf_path, linkedin_pdf_path')
            .eq('id', authUser.id)
            .maybeSingle();

          if (!active) return;

          if (profile) {
            const typedProfile = profile as StoredProfile;
            setStoredProfile(typedProfile);
            profileForm.reset({
              targetRole: typedProfile.target_role ?? draft?.targetRole ?? '',
              github: typedProfile.github_username ?? draft?.githubUsername ?? '',
            });
            return;
          }
        }

        if (draft) {
          const restoredAccount = { fullName: draft.displayName, email: draft.email, password: '' };
          const restoredProfile = { targetRole: draft.targetRole, github: draft.githubUsername };
          setAccountValues(restoredAccount);
          setProfileValues(restoredProfile);
          accountForm.reset(restoredAccount);
          profileForm.reset(restoredProfile);
        }
      } catch {
        // Fallback to initial step on storage failure
      }
    };

    void restore();

    return () => {
      active = false;
    };
  }, [accountForm, profileForm]);

  const persistDraft = (nextAccount?: SignupAccountValues, nextProfile?: SignupProfileValues) => {
    const acc = nextAccount ?? accountValues;
    const prof = nextProfile ?? profileValues;
    const draft: PendingSignupDraft = {
      displayName: acc.fullName,
      email: acc.email,
      targetRole: prof.targetRole,
      githubUsername: prof.github,
    };
    savePendingSignupDraft(draft);
  };

  const handleAccountNext = accountForm.handleSubmit((values) => {
    setAccountValues(values);
    persistDraft(values);
    setDirection(1);
    setStep(2);
  });

  const handleProfileNext = profileForm.handleSubmit((values) => {
    setProfileValues(values);
    persistDraft(undefined, values);
    setDirection(1);
    setStep(3);
  });

  const handlePrevious = () => {
    const nextStep = Math.max(1, step - 1);
    setDirection(-1);
    setStep(nextStep);
  };

  const selectDocument = async (kind: 'resume' | 'linkedin', file: File) => {
    const error = validatePdf(file);
    if (error) {
      if (kind === 'resume') setResumeError(error);
      else setLinkedinError(error);
      return;
    }

    if (kind === 'resume') {
      setResumeFile(file);
      setResumeError(null);
      await savePendingSignupDocuments({ resume: file, linkedin: linkedinFile });
    } else {
      setLinkedinFile(file);
      setLinkedinError(null);
      await savePendingSignupDocuments({ resume: resumeFile, linkedin: file });
    }
  };

  const uploadDocument = async (userId: string, kind: 'resume' | 'linkedin', file: File): Promise<string> => {
    const path = `${userId}/${kind}.pdf`;
    setProgress((prev) => ({ ...prev, [kind]: 20 }));

    const { error: uploadError } = await supabase.storage
      .from('candidate-documents')
      .upload(path, file, { upsert: true, contentType: 'application/pdf' });

    if (uploadError) {
      throw new Error(`Failed to upload ${kind}: ${uploadError.message}`);
    }

    setProgress((prev) => ({ ...prev, [kind]: 100 }));
    return path;
  };

  const handleFinalSubmit = async () => {
    if (submissionLockRef.current || isSubmitting) return;

    if (!resumeFile && !storedProfile?.resume_pdf_path) {
      setResumeError('Resume PDF is required.');
      return;
    }
    if (!linkedinFile && !storedProfile?.linkedin_pdf_path) {
      setLinkedinError('LinkedIn PDF export is required.');
      return;
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      let userId = identity?.id;

      if (!userId) {
        if (!isSupabaseConfigured) {
          userId = 'local-preview-user';
        } else {
          const { data, error: signUpError } = await supabase.auth.signUp({
            email: accountValues.email,
            password: accountValues.password,
            options: {
              data: {
                display_name: accountValues.fullName,
                role: 'student',
              },
            },
          });

          if (signUpError) {
            throw new Error(getAuthErrorMessage(signUpError, 'sign_up'));
          }

          if (data.user && !data.session) {
            setConfirmationEmail(accountValues.email);
            return;
          }

          userId = data.user?.id;
        }
      }

      if (!userId) throw new Error('Account identity could not be verified.');

      let resumePath = storedProfile?.resume_pdf_path ?? null;
      let linkedinPath = storedProfile?.linkedin_pdf_path ?? null;

      if (isSupabaseConfigured) {
        if (resumeFile) resumePath = await uploadDocument(userId, 'resume', resumeFile);
        if (linkedinFile) linkedinPath = await uploadDocument(userId, 'linkedin', linkedinFile);
      }

      const cleanGithub = normalizeGithubUsername(profileValues.github);

      if (isSupabaseConfigured) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: userId,
          role: 'student',
          display_name: accountValues.fullName || storedProfile?.display_name,
          target_role: profileValues.targetRole,
          github_username: cleanGithub,
          resume_pdf_path: resumePath,
          linkedin_pdf_path: linkedinPath,
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (profileError) throw profileError;
      }

      await clearPendingSignup();
      if (userId && isSupabaseConfigured) hydrate();

      setIsSuccess(true);
      toast.success('Profile created successfully');
      router.replace('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to complete profile creation.';
      setSubmissionError(message);
      toast.error(message);
    } finally {
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <SegmentedLoader
        message="Loading candidate workspace…"
        subtitle="Opening your readiness dashboard…"
        fullScreen
      />
    );
  }

  if (confirmationEmail) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-2xl border border-stone-800 bg-[#28201E] p-8 text-center text-stone-200 shadow-lg shadow-black/50"
      >
        <CheckCircle2 className="mx-auto h-10 w-10 text-[#D93829]" />
        <h2 className="mt-4 font-[var(--font-display)] text-xl font-bold text-stone-100">Confirm your email</h2>
        <p className="mt-2 text-xs leading-relaxed text-stone-400">
          We sent a confirmation link to <strong className="text-stone-200">{confirmationEmail}</strong>. Your form and attached PDFs are saved in this browser and will resume after confirmation.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="w-full max-w-xl rounded-2xl border border-stone-800 bg-[#28201E] p-6 text-stone-200 shadow-lg shadow-black/50 sm:p-8"
    >
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded border border-stone-700 bg-stone-800 px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider text-stone-300">
            <ShieldCheck className="h-3.5 w-3.5 text-[#D93829]" />
            <span>Profile sync</span>
          </div>
          <span className="font-mono text-xs text-stone-500">Step {step} of 3</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className={`h-1 rounded-full transition-colors ${
                item <= step ? 'bg-[#D93829]' : 'bg-stone-800'
              }`}
            />
          ))}
        </div>
        <h2 className="mt-4 font-[var(--font-display)] text-2xl font-bold tracking-tight text-stone-100 sm:text-3xl">
          {step === 1 ? 'Create your account' : step === 2 ? 'Role and GitHub identity' : 'Secure document sync'}
        </h2>
        <p className="mt-1 text-xs text-stone-400">You can replace these details later in profile settings.</p>
      </div>

      <div className="relative min-h-[280px]">
        <AnimatePresence custom={direction} mode="wait">
          {step === 1 && (
            <motion.form
              key="account"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              onSubmit={handleAccountNext}
              className="space-y-4"
            >
              <Field label="Full name" error={accountForm.formState.errors.fullName?.message} icon={<User className="h-4 w-4" />}>
                <input
                  {...accountForm.register('fullName')}
                  autoComplete="name"
                  className="auth-input"
                  placeholder="Alex Morgan"
                />
              </Field>
              <Field label="Email address" error={accountForm.formState.errors.email?.message} icon={<Mail className="h-4 w-4" />}>
                <input
                  {...accountForm.register('email')}
                  type="email"
                  autoComplete="email"
                  className="auth-input"
                  placeholder="alex@college.edu"
                />
              </Field>
              <Field label="Password" error={accountForm.formState.errors.password?.message} icon={<Lock className="h-4 w-4" />}>
                <input
                  {...accountForm.register('password')}
                  type="password"
                  autoComplete="new-password"
                  className="auth-input"
                  placeholder="Minimum 8 characters"
                />
              </Field>
              <PrimaryButton label="Next: career goal" />
            </motion.form>
          )}

          {step === 2 && (
            <motion.form
              key="profile"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              onSubmit={(event) => void handleProfileNext(event)}
              className="space-y-4"
            >
              {identity && (
                <div className="rounded-lg border border-stone-700 bg-stone-800/80 p-3 text-xs text-stone-300">
                  <CheckCircle2 className="mr-2 inline h-4 w-4 text-[#D93829]" />
                  Confirmed account: {identity.email}
                </div>
              )}
              <Field label="Target role" error={profileForm.formState.errors.targetRole?.message} icon={<ShieldCheck className="h-4 w-4" />}>
                <input
                  {...profileForm.register('targetRole')}
                  className="auth-input"
                  placeholder="Frontend Engineer"
                />
              </Field>
              <Field label="GitHub username or URL" error={profileForm.formState.errors.github?.message} icon={<GitBranch className="h-4 w-4" />}>
                <input
                  {...profileForm.register('github')}
                  autoComplete="off"
                  className="auth-input"
                  placeholder="octocat or github.com/octocat"
                />
              </Field>
              <div className="flex gap-2.5 pt-2">
                {!identity && <BackButton onClick={handlePrevious} />}
                <PrimaryButton label="Next: upload documents" />
              </div>
            </motion.form>
          )}

          {step === 3 && (
            <motion.div
              key="documents"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
            >
              <SignupPdfDropzone
                label="Resume PDF"
                description="Drop your resume here, or browse"
                file={resumeFile}
                existingDocument={Boolean(storedProfile?.resume_pdf_path)}
                error={resumeError}
                progress={progress.resume}
                onChange={(file) => void selectDocument('resume', file)}
              />
              <div>
                <div className="mb-1.5 flex justify-end">
                  <LinkedInPdfTooltip />
                </div>
                <SignupPdfDropzone
                  label="LinkedIn profile PDF"
                  description="Drop your LinkedIn export here, or browse"
                  file={linkedinFile}
                  existingDocument={Boolean(storedProfile?.linkedin_pdf_path)}
                  error={linkedinError}
                  progress={progress.linkedin}
                  onChange={(file) => void selectDocument('linkedin', file)}
                />
              </div>
              {submissionError && (
                <div role="alert" className="rounded-lg border border-red-900/50 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-300">
                  {submissionError}
                </div>
              )}
              <div className="flex gap-2.5 pt-2">
                <BackButton onClick={handlePrevious} disabled={isSubmitting} />
                <button
                  type="button"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  onClick={() => void handleFinalSubmit()}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Syncing securely…</span>
                    </>
                  ) : (
                    <>
                      <span>Create profile</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!identity && (
        <div className="mt-6 border-t border-stone-800 pt-5 text-center text-xs text-stone-400">
          Already registered?{' '}
          <button
            type="button"
            onClick={onToggleLogin}
            className="font-medium text-[#D93829] transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
          >
            Sign in
          </button>
        </div>
      )}
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
      <span className="mb-1 block text-xs font-medium text-stone-300">
        {label} <span className="text-[#D93829]">*</span>
      </span>
      <span className="relative block">
        {children}
        <span className="pointer-events-none absolute right-3.5 top-3.5 text-stone-500">{icon}</span>
      </span>
      {error && <span role="alert" className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}

function PrimaryButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]"
    >
      <span>{label}</span>
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}

function BackButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Previous step"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-stone-800 bg-stone-900 text-stone-300 transition-colors hover:bg-stone-800 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829] disabled:opacity-40"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}

export default SignUpWizard;
