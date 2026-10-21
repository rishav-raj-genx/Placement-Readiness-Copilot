'use client';

import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Loader2,
  Lock,
  Mail,
  User,
  ShieldCheck,
  Code2,
  Plus,
  Trash2,
  ExternalLink,
  Edit3,
  FileText,
  X,
  FastForward,
} from 'lucide-react';
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
  validateResumeFile,
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
import type { ProjectItem } from '@/types';

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
  leetcode_url?: string | null;
  coding_profile_url?: string | null;
  linkedin_text?: string | null;
  projects?: ProjectItem[] | null;
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
  enter: (direction: number) => ({ x: direction > 0 ? 30 : -30, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.18, ease: 'easeOut' } },
  exit: (direction: number) => ({
    x: direction > 0 ? -30 : 30,
    opacity: 0,
    transition: { duration: 0.15, ease: 'easeIn' },
  }),
};

const STEPS = [
  { id: 1, title: 'Account', subtitle: 'Credentials' },
  { id: 2, title: 'Roles & Profiles', subtitle: 'Target & Code' },
  { id: 3, title: 'Projects', subtitle: 'Featured Work' },
  { id: 4, title: 'Documents', subtitle: 'Resume & LinkedIn' },
];

export function SignUpWizard({ onToggleLogin }: SignUpWizardProps) {
  const router = useRouter();
  const hydrate = useAuthStore((state) => state.hydrate);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [identity, setIdentity] = useState<AuthenticatedIdentity | null>(null);
  const [storedProfile, setStoredProfile] = useState<StoredProfile | null>(null);
  const [accountValues, setAccountValues] = useState<SignupAccountValues>(EMPTY_ACCOUNT);
  const [profileValues, setProfileValues] = useState<SignupProfileValues>(EMPTY_PROFILE);
  const [leetcodeUrl, setLeetcodeUrl] = useState('');
  const [linkedinText, setLinkedinText] = useState('');
  const [projects, setProjects] = useState<ProjectItem[]>([]);
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

  // Project Modal State
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProjectIndex, setEditingProjectIndex] = useState<number | null>(null);
  const [projectForm, setProjectForm] = useState<{
    title: string;
    repoUrl: string;
    liveUrl: string;
    description: string;
  }>({ title: '', repoUrl: '', liveUrl: '', description: '' });

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
            .select('display_name, target_role, github_username, leetcode_url, coding_profile_url, linkedin_text, projects, resume_pdf_path, linkedin_pdf_path')
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
            if (typedProfile.leetcode_url || draft?.leetcodeUrl) {
              setLeetcodeUrl(typedProfile.leetcode_url ?? draft?.leetcodeUrl ?? '');
            }
            if (typedProfile.linkedin_text || draft?.linkedinText) {
              setLinkedinText(typedProfile.linkedin_text ?? draft?.linkedinText ?? '');
            }
            if (typedProfile.projects && typedProfile.projects.length > 0) {
              setProjects(typedProfile.projects);
            } else if (draft?.projects && draft.projects.length > 0) {
              setProjects(draft.projects);
            }
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
          if (draft.leetcodeUrl) setLeetcodeUrl(draft.leetcodeUrl);
          if (draft.linkedinText) setLinkedinText(draft.linkedinText);
          if (draft.projects && draft.projects.length > 0) setProjects(draft.projects);
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

  const persistDraft = (
    nextAccount?: SignupAccountValues,
    nextProfile?: SignupProfileValues,
    nextLeetcode?: string,
    nextLinkedinText?: string,
    nextProjects?: ProjectItem[],
  ) => {
    const acc = nextAccount ?? accountValues;
    const prof = nextProfile ?? profileValues;
    const draft: PendingSignupDraft = {
      displayName: acc.fullName,
      email: acc.email,
      targetRole: prof.targetRole,
      githubUsername: prof.github,
      leetcodeUrl: nextLeetcode ?? leetcodeUrl,
      linkedinText: nextLinkedinText ?? linkedinText,
      projects: nextProjects ?? projects,
    };
    savePendingSignupDraft(draft);
  };

  const goToStep = (targetStep: number) => {
    if (targetStep === step) return;
    setDirection(targetStep > step ? 1 : -1);
    setStep(targetStep);
  };

  const handleAccountNext = accountForm.handleSubmit((values) => {
    setAccountValues(values);
    persistDraft(values);
    setDirection(1);
    setStep(2);
  });

  const handleProfileNext = profileForm.handleSubmit((values) => {
    setProfileValues(values);
    persistDraft(undefined, values, leetcodeUrl);
    setDirection(1);
    setStep(3);
  });

  const handlePrevious = () => {
    const prev = Math.max(1, step - 1);
    setDirection(-1);
    setStep(prev);
  };

  const selectDocument = async (kind: 'resume' | 'linkedin', file: File) => {
    const error = kind === 'resume' ? validateResumeFile(file) : validatePdf(file);
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
    const isDocx = file.name.toLowerCase().endsWith('.docx');
    const ext = isDocx ? 'docx' : 'pdf';
    const contentType = isDocx
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';
    const path = `${userId}/${kind}.${ext}`;
    setProgress((prev) => ({ ...prev, [kind]: 20 }));

    const { error: uploadError } = await supabase.storage
      .from('candidate-documents')
      .upload(path, file, { upsert: true, contentType });

    if (uploadError) {
      throw new Error(`Failed to upload ${kind}: ${uploadError.message}`);
    }

    setProgress((prev) => ({ ...prev, [kind]: 100 }));
    return path;
  };

  // Project Modal Actions
  const openAddProjectModal = () => {
    setEditingProjectIndex(null);
    setProjectForm({ title: '', repoUrl: '', liveUrl: '', description: '' });
    setIsProjectModalOpen(true);
  };

  const openEditProjectModal = (index: number) => {
    const p = projects[index];
    if (!p) return;
    setEditingProjectIndex(index);
    setProjectForm({
      title: p.title || p.name || '',
      repoUrl: p.repoUrl || p.githubUrl || '',
      liveUrl: p.liveUrl || '',
      description: p.description || '',
    });
    setIsProjectModalOpen(true);
  };

  const saveProject = () => {
    if (!projectForm.title.trim() && !projectForm.description.trim()) {
      toast.error('Please enter a project title or description.');
      return;
    }

    const item: ProjectItem = {
      title: projectForm.title.trim() || 'Untitled Project',
      repoUrl: projectForm.repoUrl.trim() || undefined,
      githubUrl: projectForm.repoUrl.trim() || undefined,
      liveUrl: projectForm.liveUrl.trim() || undefined,
      description: projectForm.description.trim(),
    };

    let updated: ProjectItem[];
    if (editingProjectIndex !== null) {
      updated = [...projects];
      updated[editingProjectIndex] = item;
    } else {
      updated = [...projects, item];
    }

    setProjects(updated);
    persistDraft(undefined, undefined, undefined, undefined, updated);
    setIsProjectModalOpen(false);
    toast.success(editingProjectIndex !== null ? 'Project updated.' : 'Project added.');
  };

  const deleteProject = (index: number) => {
    const updated = projects.filter((_, i) => i !== index);
    setProjects(updated);
    persistDraft(undefined, undefined, undefined, undefined, updated);
    toast.info('Project removed.');
  };

  // Final Submission (Flexible Any-Order, PDFs Optional)
  const handleFinalSubmit = async () => {
    if (submissionLockRef.current || isSubmitting) return;

    // Check account requirements if user is not already logged in
    if (!identity) {
      const email = accountValues.email || accountForm.getValues('email');
      const password = accountValues.password || accountForm.getValues('password');
      if (!email || !password) {
        toast.error('Please complete account credentials first.');
        setDirection(-1);
        setStep(1);
        return;
      }
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
            email: accountValues.email || accountForm.getValues('email'),
            password: accountValues.password || accountForm.getValues('password'),
            options: {
              data: {
                display_name: accountValues.fullName || accountForm.getValues('fullName'),
                role: 'student',
              },
            },
          });

          if (signUpError) {
            throw new Error(getAuthErrorMessage(signUpError, 'sign_up'));
          }

          if (data.user && !data.session) {
            setConfirmationEmail(accountValues.email || accountForm.getValues('email'));
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

      const rawGithub = profileValues.github || profileForm.getValues('github') || '';
      const cleanGithub = rawGithub ? normalizeGithubUsername(rawGithub) : null;
      const effectiveRole = profileValues.targetRole || profileForm.getValues('targetRole') || storedProfile?.target_role || 'Software Engineer';
      const effectiveName = accountValues.fullName || accountForm.getValues('fullName') || storedProfile?.display_name || 'Candidate';

      if (isSupabaseConfigured) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: userId,
          role: 'student',
          display_name: effectiveName,
          target_role: effectiveRole,
          github_username: cleanGithub,
          leetcode_url: leetcodeUrl.trim() || storedProfile?.leetcode_url || null,
          linkedin_text: linkedinText.trim() || storedProfile?.linkedin_text || null,
          projects: projects.length > 0 ? projects : (storedProfile?.projects ?? null),
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
          We sent a confirmation link to <strong className="text-stone-200">{confirmationEmail}</strong>. Your form and attached documents are saved in this browser and will resume after confirmation.
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
      {/* Header & Step Badges */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded border border-stone-700 bg-stone-800 px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider text-stone-300">
            <ShieldCheck className="h-3.5 w-3.5 text-[#D93829]" />
            <span>Flexible intake</span>
          </div>
          <span className="font-mono text-xs text-stone-500">Step {step} of 4</span>
        </div>

        {/* Any-Order Clickable Step Navigation */}
        <div className="mt-4 grid grid-cols-4 gap-2" aria-label="Step progress">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goToStep(s.id)}
              className="group flex flex-col text-left focus:outline-none"
            >
              <div
                className={`h-1.5 w-full rounded-full transition-colors ${
                  s.id === step
                    ? 'bg-[#D93829]'
                    : s.id < step
                      ? 'bg-[#D93829]/70'
                      : 'bg-stone-800 group-hover:bg-stone-700'
                }`}
              />
              <span className={`mt-1.5 truncate text-[10px] font-medium transition-colors ${
                s.id === step ? 'text-stone-100 font-semibold' : 'text-stone-400 group-hover:text-stone-300'
              }`}>
                {s.title}
              </span>
            </button>
          ))}
        </div>

        <h2 className="mt-4 font-[var(--font-display)] text-2xl font-bold tracking-tight text-stone-100 sm:text-3xl">
          {step === 1 && 'Create your account'}
          {step === 2 && 'Target role & coding links'}
          {step === 3 && 'Showcase your projects'}
          {step === 4 && 'Resume & experience'}
        </h2>
        <p className="mt-1 text-xs text-stone-400">
          All steps are flexible. Fill in what you have now or complete later from your dashboard.
        </p>
      </div>

      {/* Main Step Content */}
      <div className="relative min-h-[300px]">
        <AnimatePresence custom={direction} mode="wait">
          {/* STEP 1: ACCOUNT */}
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
              <div className="flex gap-2.5 pt-2">
                <PrimaryButton label="Next: career & code" />
              </div>
            </motion.form>
          )}

          {/* STEP 2: ROLE & CODING PROFILES */}
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
              <Field label="GitHub username or profile URL" error={profileForm.formState.errors.github?.message} icon={<GitBranch className="h-4 w-4" />}>
                <input
                  {...profileForm.register('github')}
                  autoComplete="off"
                  className="auth-input"
                  placeholder="octocat or github.com/octocat"
                />
              </Field>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-stone-300">
                  LeetCode / Coding profile URL <span className="text-stone-500 font-normal">(optional)</span>
                </span>
                <span className="relative block">
                  <input
                    value={leetcodeUrl}
                    onChange={(e) => {
                      setLeetcodeUrl(e.target.value);
                      persistDraft(undefined, undefined, e.target.value);
                    }}
                    autoComplete="off"
                    className="auth-input"
                    placeholder="https://leetcode.com/u/yourhandle"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-3.5 text-stone-500">
                    <Code2 className="h-4 w-4" />
                  </span>
                </span>
              </label>

              <div className="flex items-center gap-2.5 pt-2">
                {!identity && <BackButton onClick={handlePrevious} />}
                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900 px-4 text-xs font-semibold text-stone-300 transition-colors hover:bg-stone-800"
                >
                  <FastForward className="h-3.5 w-3.5" />
                  <span>Skip step</span>
                </button>
                <div className="flex-1">
                  <PrimaryButton label="Next: projects" />
                </div>
              </div>
            </motion.form>
          )}

          {/* STEP 3: PROJECTS (DEDICATED MODAL & FORM) */}
          {step === 3 && (
            <motion.div
              key="projects"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
            >
              <div className="flex items-center justify-between rounded-xl border border-stone-800 bg-stone-900/60 p-4">
                <div>
                  <h3 className="text-xs font-semibold text-stone-100">Featured Projects</h3>
                  <p className="text-[11px] text-stone-400">
                    Add projects with repo URLs, live demos, and technical descriptions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddProjectModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#D93829] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add project</span>
                </button>
              </div>

              {projects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-800 bg-stone-900/30 p-8 text-center">
                  <Code2 className="mx-auto h-8 w-8 text-stone-600" />
                  <p className="mt-2 text-xs font-medium text-stone-300">No projects added yet</p>
                  <p className="mt-1 text-[11px] text-stone-500">
                    You can add projects now or skip and sync your GitHub repositories later.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {projects.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-3 rounded-lg border border-stone-800 bg-stone-900/80 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs font-semibold text-stone-200">
                            {item.title || item.name}
                          </p>
                          {item.repoUrl && (
                            <span className="inline-flex items-center gap-1 rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-stone-400">
                              <GitBranch className="h-3 w-3" /> Repo
                            </span>
                          )}
                          {item.liveUrl && (
                            <span className="inline-flex items-center gap-1 rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-stone-400">
                              <ExternalLink className="h-3 w-3" /> Live
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] text-stone-400">
                          {item.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditProjectModal(idx)}
                          className="rounded p-1 text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                          aria-label="Edit project"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProject(idx)}
                          className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                          aria-label="Delete project"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2.5 pt-2">
                <BackButton onClick={handlePrevious} />
                <button
                  type="button"
                  onClick={() => goToStep(4)}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900 px-4 text-xs font-semibold text-stone-300 transition-colors hover:bg-stone-800"
                >
                  <FastForward className="h-3.5 w-3.5" />
                  <span>Skip step</span>
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(4)}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21]"
                >
                  <span>Next: documents & bio</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: RESUME & LINKEDIN (ACCEPTS .DOCX AND TEXTAREA BIO) */}
          {step === 4 && (
            <motion.div
              key="documents"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
            >
              {/* Resume: accepts .pdf and .docx */}
              <SignupPdfDropzone
                label="Resume (.pdf or .docx)"
                description="Drop your resume here, or browse (.pdf, .docx)"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                fileTypeLabel="PDF or DOCX"
                file={resumeFile}
                existingDocument={Boolean(storedProfile?.resume_pdf_path)}
                error={resumeError}
                progress={progress.resume}
                onChange={(file) => void selectDocument('resume', file)}
              />

              {/* LinkedIn: PDF export OR direct text area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-stone-300">LinkedIn Profile / Experience</span>
                  <LinkedInPdfTooltip />
                </div>
                <SignupPdfDropzone
                  label="LinkedIn export PDF (optional)"
                  description="Drop your LinkedIn PDF export here, or browse"
                  file={linkedinFile}
                  existingDocument={Boolean(storedProfile?.linkedin_pdf_path)}
                  error={linkedinError}
                  progress={progress.linkedin}
                  onChange={(file) => void selectDocument('linkedin', file)}
                />
                <div className="pt-1">
                  <label className="mb-1 block text-xs font-medium text-stone-300">
                    Or paste LinkedIn profile / bio text directly
                  </label>
                  <textarea
                    value={linkedinText}
                    onChange={(e) => {
                      setLinkedinText(e.target.value);
                      persistDraft(undefined, undefined, undefined, e.target.value);
                    }}
                    placeholder="Paste summary, experience bullets, education, or skills here..."
                    rows={3}
                    className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2.5 text-xs text-stone-100 placeholder:text-stone-600 focus:border-[#D93829] focus:outline-none focus:ring-1 focus:ring-[#D93829]"
                  />
                </div>
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
                      <span>Creating profile…</span>
                    </>
                  ) : (
                    <>
                      <span>Complete profile</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Global Quick Finish / Bypass Option */}
      {step < 4 && (
        <div className="mt-4 flex items-center justify-between border-t border-stone-800/80 pt-3">
          <p className="text-[11px] text-stone-400">Want to add evidence later?</p>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleFinalSubmit()}
            className="text-[11px] font-semibold text-stone-300 underline decoration-stone-600 underline-offset-4 hover:text-[#D93829]"
          >
            Skip & Enter Dashboard
          </button>
        </div>
      )}

      {!identity && (
        <div className="mt-4 border-t border-stone-800 pt-4 text-center text-xs text-stone-400">
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

      {/* Dedicated Project Details Modal */}
      {isProjectModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-[#28201E] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-display text-base font-bold text-stone-100">
                {editingProjectIndex !== null ? 'Edit Project' : 'Add Project Details'}
              </h3>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                className="rounded p-1 text-stone-400 hover:text-stone-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-300">
                  Project Title <span className="text-[#D93829]">*</span>
                </label>
                <input
                  type="text"
                  value={projectForm.title}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Distributed Task Queue"
                  className="auth-input"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-stone-300">
                  Repository URL
                </label>
                <input
                  type="url"
                  value={projectForm.repoUrl}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, repoUrl: e.target.value }))}
                  placeholder="https://github.com/username/project"
                  className="auth-input"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-stone-300">
                  Live Demo Link
                </label>
                <input
                  type="url"
                  value={projectForm.liveUrl}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, liveUrl: e.target.value }))}
                  placeholder="https://my-app.vercel.app"
                  className="auth-input"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-stone-300">
                  Project Description <span className="text-[#D93829]">*</span>
                </label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Key features, architecture, tools used, and measurable impact..."
                  rows={3}
                  className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2.5 text-xs text-stone-100 placeholder:text-stone-600 focus:border-[#D93829] focus:outline-none focus:ring-1 focus:ring-[#D93829]"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                className="rounded-lg border border-stone-800 bg-stone-900 px-4 py-2 text-xs font-semibold text-stone-300 hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProject}
                className="rounded-lg bg-[#D93829] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21]"
              >
                Save Project
              </button>
            </div>
          </div>
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
