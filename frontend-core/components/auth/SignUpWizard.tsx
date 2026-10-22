'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Code2,
  Eye,
  EyeOff,
  FileText,
  Github,
  Linkedin,
  Loader2,
  Lock,
  Mail,
  Paperclip,
  ShieldCheck,
  UploadCloud,
  User,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import {
  normalizeGithubUsername,
  validateResumeFile,
  validatePdf,
} from '@/lib/onboarding';
import {
  clearPendingSignup,
  loadPendingSignupDocuments,
  loadPendingSignupDraft,
  savePendingSignupDocuments,
  savePendingSignupDraft,
} from '@/lib/signup-draft';
import { useAuthStore } from '@/stores/auth-store';
import { getAuthErrorMessage } from '@/lib/auth-errors';

export interface SignUpWizardProps {
  onToggleLogin: () => void;
}

const COMMON_ROLES = [
  'Full-Stack Software Engineer',
  'Frontend Engineer',
  'Backend Engineer',
  'Software Development Engineer (SDE)',
  'AI / Machine Learning Engineer',
  'Cloud & DevOps Engineer',
  'Data Engineer',
  'Mobile Developer (iOS / Android)',
  'Custom / Other Role',
];

export function SignUpWizard({ onToggleLogin }: SignUpWizardProps) {
  const router = useRouter();
  const hydrate = useAuthStore((state) => state.hydrate);

  // Step state (1: Account Details, 2: Professional Profile)
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Account credentials
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [targetRole, setTargetRole] = useState(COMMON_ROLES[0]);
  const [customRole, setCustomRole] = useState('');

  // Step 2: Professional profile & proof
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [linkedinFile, setLinkedinFile] = useState<File | null>(null);
  const [github, setGithub] = useState('');
  const [leetcodeUrl, setLeetcodeUrl] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [isDraggingResume, setIsDraggingResume] = useState(false);
  const [showLinkedinPdfInput, setShowLinkedinPdfInput] = useState(false);

  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const linkedinInputRef = useRef<HTMLInputElement | null>(null);

  // Restore saved draft & documents if returning
  useEffect(() => {
    let active = true;

    const restore = async () => {
      try {
        const [draft, documents] = await Promise.all([
          Promise.resolve(loadPendingSignupDraft()),
          loadPendingSignupDocuments(),
        ]);
        if (!active) return;

        if (draft) {
          if (draft.displayName) setFullName(draft.displayName);
          if (draft.email) setEmail(draft.email);
          if (draft.targetRole) {
            if (COMMON_ROLES.includes(draft.targetRole)) {
              setTargetRole(draft.targetRole);
            } else {
              setTargetRole('Custom / Other Role');
              setCustomRole(draft.targetRole);
            }
          }
          if (draft.githubUsername) setGithub(draft.githubUsername);
          if (draft.leetcodeUrl) setLeetcodeUrl(draft.leetcodeUrl);
          if (draft.linkedinUrl) setLinkedinUrl(draft.linkedinUrl);
        }

        if (documents.resume) setResumeFile(documents.resume);
        if (documents.linkedin) {
          setLinkedinFile(documents.linkedin);
          setShowLinkedinPdfInput(true);
        }
      } catch {
        // Fallback gracefully
      }
    };

    void restore();
    return () => {
      active = false;
    };
  }, []);

  const effectiveRole = targetRole === 'Custom / Other Role' ? customRole.trim() : targetRole;

  // Validate step 1 before proceeding
  const handleNextStep = () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      toast.error('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }
    if (targetRole === 'Custom / Other Role' && !customRole.trim()) {
      toast.error('Please enter your custom target role.');
      return;
    }

    // Save non-sensitive draft progress
    savePendingSignupDraft({
      displayName: fullName.trim(),
      email: email.trim(),
      targetRole: effectiveRole,
      githubUsername: github.trim(),
      leetcodeUrl: leetcodeUrl.trim(),
      linkedinUrl: linkedinUrl.trim(),
    });

    setStep(2);
  };

  const handleResumeChange = async (file: File) => {
    const error = validateResumeFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setResumeFile(file);
    await savePendingSignupDocuments({ resume: file, linkedin: linkedinFile });
    toast.success(`Attached resume: ${file.name}`);
  };

  const handleLinkedInPdfChange = async (file: File) => {
    const error = validatePdf(file);
    if (error) {
      toast.error(error);
      return;
    }
    setLinkedinFile(file);
    await savePendingSignupDocuments({ resume: resumeFile, linkedin: file });
    toast.success(`Attached LinkedIn PDF: ${file.name}`);
  };

  // Final Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!fullName.trim() || !email.trim() || !password) {
      setStep(1);
      toast.error('Please complete all required account fields.');
      return;
    }

    if (github.trim()) {
      const normalized = normalizeGithubUsername(github.trim());
      if (!normalized) {
        toast.error('Please enter a valid GitHub username or repository URL.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (!isSupabaseConfigured) {
        toast.success('Local preview mode: Account initialized.');
        router.replace('/dashboard?tour=1');
        return;
      }

      // 1. Create Supabase Auth credentials
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: fullName.trim(),
            role: 'student',
          },
        },
      });

      if (error) {
        throw new Error(getAuthErrorMessage(error, 'sign_up'));
      }

      if (!data.user) {
        throw new Error('Sign up failed — no user identity returned.');
      }

      // Check if email confirmation is required
      if (!data.session) {
        setConfirmationEmail(email.trim());
        setIsSubmitting(false);
        return;
      }

      const userId = data.user.id;
      let uploadedResumePath: string | null = null;
      let uploadedLinkedinPath: string | null = null;

      // 2. Upload resume file if selected
      if (resumeFile) {
        try {
          const isDocx = resumeFile.name.toLowerCase().endsWith('.docx');
          const ext = isDocx ? 'docx' : 'pdf';
          const contentType = isDocx
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/pdf';
          const path = `${userId}/resume.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('candidate-documents')
            .upload(path, resumeFile, { upsert: true, contentType });

          if (!uploadError) {
            uploadedResumePath = path;
          }
        } catch {
          // Non-blocking: profile record will still succeed
        }
      }

      // 3. Upload LinkedIn PDF file if selected
      if (linkedinFile) {
        try {
          const path = `${userId}/linkedin.pdf`;
          const { error: uploadError } = await supabase.storage
            .from('candidate-documents')
            .upload(path, linkedinFile, { upsert: true, contentType: 'application/pdf' });

          if (!uploadError) {
            uploadedLinkedinPath = path;
          }
        } catch {
          // Non-blocking
        }
      }

      // 4. Upsert complete profile record
      const normalizedGithub = github.trim() ? normalizeGithubUsername(github.trim()) : null;
      const profileData: Record<string, unknown> = {
        id: userId,
        role: 'student',
        email: email.trim(),
        display_name: fullName.trim(),
        target_role: effectiveRole || 'Software Engineer',
        github_username: normalizedGithub || null,
        leetcode_url: leetcodeUrl.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        resume_pdf_path: uploadedResumePath,
        linkedin_pdf_path: uploadedLinkedinPath,
        onboarding_completed_at: new Date().toISOString(),
        created_at: data.user.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData);

      if (profileError) {
        const errStr = (profileError.message || '').toLowerCase();
        if (
          profileError.code === 'PGRST204' ||
          errStr.includes('leetcode_url') ||
          errStr.includes('linkedin_url') ||
          errStr.includes('column')
        ) {
          delete profileData.leetcode_url;
          delete profileData.linkedin_url;
          await supabase.from('profiles').upsert(profileData);
        }
      }

      // 5. Cleanup draft & hydrate auth store
      await clearPendingSignup();
      hydrate();

      toast.success('Account created! Welcome to Hireable.');
      router.replace('/dashboard?tour=1');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create candidate account.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Email confirmation notice view
  if (confirmationEmail) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-stone-800 bg-[#28201E] p-7 text-center text-stone-200 shadow-lg shadow-black/50 sm:p-9">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10 text-orange-400">
          <Mail className="h-7 w-7" />
        </div>
        <h3 className="font-[var(--font-display)] text-xl font-bold text-stone-100">
          Check your inbox
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-stone-400 max-w-sm mx-auto">
          We sent a verification link to <strong className="text-stone-200">{confirmationEmail}</strong>. Please confirm your email to activate your placement account.
        </p>
        <button
          type="button"
          onClick={onToggleLogin}
          className="mt-6 inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-900 px-4 py-2 text-xs font-semibold text-stone-200 transition-colors hover:border-stone-600 hover:text-white"
        >
          Proceed to Login &rarr;
        </button>
      </div>
    );
  }

  return (
    <motion.div
      key="signup-module"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="w-full max-w-lg rounded-2xl border border-stone-800 bg-[#28201E] p-6 text-stone-200 shadow-lg shadow-black/50 sm:p-8"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 rounded border border-stone-700 bg-stone-800 px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider text-stone-300">
          <ShieldCheck className="h-3.5 w-3.5 text-[#D93829]" />
          <span>Candidate Onboarding</span>
        </div>
        <h2 className="mt-3 font-[var(--font-display)] text-2xl font-bold tracking-tight text-stone-100 sm:text-3xl">
          Create candidate account
        </h2>
        <p className="mt-1 text-xs text-stone-400 sm:text-sm">
          Set up your credentials and evidence profile to benchmark your placement readiness.
        </p>
      </div>

      {/* Step Indicator Progress Bar */}
      <div className="mb-6 flex items-center justify-between border-b border-stone-800/80 pb-4">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`flex items-center gap-2 text-xs font-medium transition-colors ${
            step === 1 ? 'text-[#D93829]' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <span
            className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
              step === 1
                ? 'bg-[#D93829] text-white'
                : 'border border-emerald-500/40 bg-emerald-950/40 text-emerald-400'
            }`}
          >
            {step === 2 ? '✓' : '1'}
          </span>
          <span>1. Account Details</span>
        </button>

        <div className="h-px flex-1 bg-stone-800 mx-3" />

        <button
          type="button"
          onClick={() => {
            if (fullName && email && password.length >= 8) {
              setStep(2);
            } else {
              handleNextStep();
            }
          }}
          className={`flex items-center gap-2 text-xs font-medium transition-colors ${
            step === 2 ? 'text-[#D93829]' : 'text-stone-500 hover:text-stone-300'
          }`}
        >
          <span
            className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
              step === 2
                ? 'bg-[#D93829] text-white'
                : 'border border-stone-700 bg-stone-900 text-stone-500'
            }`}
          >
            2
          </span>
          <span>2. Professional Profile</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {step === 1 ? (
          /* STEP 1: Account Details */
          <div className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="signup-name" className="block text-xs font-semibold text-stone-300 mb-1.5">
                Full Name <span className="text-[#D93829]">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-500">
                  <User className="h-4 w-4" />
                </span>
                <input
                  id="signup-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., Alex Johnson"
                  className="w-full rounded-xl border border-stone-700 bg-stone-900 py-2.5 pl-10 pr-3.5 text-xs sm:text-sm text-stone-100 placeholder:text-stone-500 focus:border-[#D93829] focus:outline-none focus:ring-1 focus:ring-[#D93829]"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label htmlFor="signup-email" className="block text-xs font-semibold text-stone-300 mb-1.5">
                Email Address <span className="text-[#D93829]">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-500">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidate@university.edu"
                  className="w-full rounded-xl border border-stone-700 bg-stone-900 py-2.5 pl-10 pr-3.5 text-xs sm:text-sm text-stone-100 placeholder:text-stone-500 focus:border-[#D93829] focus:outline-none focus:ring-1 focus:ring-[#D93829]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signup-password" className="block text-xs font-semibold text-stone-300 mb-1.5">
                Password (8+ characters) <span className="text-[#D93829]">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-500">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create secure password"
                  className="w-full rounded-xl border border-stone-700 bg-stone-900 py-2.5 pl-10 pr-10 text-xs sm:text-sm text-stone-100 placeholder:text-stone-500 focus:border-[#D93829] focus:outline-none focus:ring-1 focus:ring-[#D93829]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-stone-500 hover:text-stone-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Target Role */}
            <div>
              <label htmlFor="signup-role" className="block text-xs font-semibold text-stone-300 mb-1.5">
                Target Role <span className="text-[#D93829]">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-500">
                  <Briefcase className="h-4 w-4" />
                </span>
                <select
                  id="signup-role"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-stone-700 bg-stone-900 py-2.5 pl-10 pr-8 text-xs sm:text-sm text-stone-100 focus:border-[#D93829] focus:outline-none focus:ring-1 focus:ring-[#D93829]"
                >
                  {COMMON_ROLES.map((role) => (
                    <option key={role} value={role} className="bg-stone-900 text-stone-100">
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {targetRole === 'Custom / Other Role' && (
                <div className="mt-2.5">
                  <input
                    type="text"
                    required
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="Enter your exact target job title (e.g., Embedded Systems Engineer)"
                    className="w-full rounded-xl border border-stone-700 bg-stone-900 px-3.5 py-2 text-xs sm:text-sm text-stone-100 placeholder:text-stone-500 focus:border-[#D93829] focus:outline-none focus:ring-1 focus:ring-[#D93829]"
                  />
                </div>
              )}
            </div>

            {/* Step 1 Actions */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleNextStep}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-xs sm:text-sm font-semibold text-white shadow-md shadow-red-950/40 transition-colors hover:bg-red-500"
              >
                <span>Continue to Professional Profile</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: Professional Profile & Evidence */
          <div className="space-y-4">
            {/* Resume Upload Dropzone */}
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                Resume File <span className="font-normal text-stone-400">(PDF or DOCX up to 10 MB)</span>
              </label>

              <input
                ref={resumeInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleResumeChange(file);
                    e.target.value = '';
                  }
                }}
              />

              {resumeFile ? (
                <div className="flex items-center justify-between rounded-xl border border-orange-500/40 bg-orange-950/30 p-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-600/20 text-orange-400">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-stone-200">
                        {resumeFile.name}
                      </p>
                      <p className="text-[10px] text-stone-400">
                        {(resumeFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI parsing
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => resumeInputRef.current?.click()}
                      className="rounded-lg border border-stone-700 bg-stone-900 px-2 py-1 text-[11px] text-stone-300 hover:text-white"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeFile(null)}
                      className="rounded-lg p-1 text-stone-500 hover:bg-stone-800 hover:text-stone-300"
                      aria-label="Remove resume"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingResume(true);
                  }}
                  onDragLeave={() => setIsDraggingResume(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingResume(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void handleResumeChange(file);
                  }}
                  onClick={() => resumeInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
                    isDraggingResume
                      ? 'border-[#D93829] bg-[#D93829]/10'
                      : 'border-stone-700 bg-stone-900/50 hover:border-stone-500 hover:bg-stone-900'
                  }`}
                >
                  <UploadCloud className="h-6 w-6 text-stone-400 mb-1" />
                  <p className="text-xs font-semibold text-stone-200">
                    Click to browse or drop resume here
                  </p>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    Supports .pdf and .docx (Max 10 MB)
                  </p>
                </div>
              )}
            </div>

            {/* LinkedIn Profile */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="signup-linkedin" className="text-xs font-semibold text-stone-300">
                  LinkedIn Profile
                </label>
                <button
                  type="button"
                  onClick={() => setShowLinkedinPdfInput((prev) => !prev)}
                  className="text-[11px] font-medium text-orange-400 hover:underline"
                >
                  {showLinkedinPdfInput ? 'Hide PDF option' : '+ Attach LinkedIn PDF'}
                </button>
              </div>

              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-500">
                  <Linkedin className="h-4 w-4" />
                </span>
                <input
                  id="signup-linkedin"
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full rounded-xl border border-stone-700 bg-stone-900 py-2.5 pl-10 pr-3.5 text-xs sm:text-sm text-stone-100 placeholder:text-stone-500 focus:border-[#D93829] focus:outline-none focus:ring-1 focus:ring-[#D93829]"
                />
              </div>

              {/* Optional LinkedIn PDF Uploader */}
              {showLinkedinPdfInput && (
                <div className="mt-2.5 rounded-xl border border-stone-800 bg-stone-900/80 p-3">
                  <input
                    ref={linkedinInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleLinkedInPdfChange(file);
                        e.target.value = '';
                      }
                    }}
                  />
                  {linkedinFile ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate text-stone-200">📄 {linkedinFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setLinkedinFile(null)}
                        className="p-1 text-stone-500 hover:text-stone-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => linkedinInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200"
                    >
                      <Paperclip className="h-3.5 w-3.5 text-orange-400" />
                      <span>Upload exported LinkedIn Profile PDF (Max 10 MB)</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* GitHub URL */}
            <div>
              <label htmlFor="signup-github" className="block text-xs font-semibold text-stone-300 mb-1">
                GitHub Profile
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-500">
                  <Github className="h-4 w-4" />
                </span>
                <input
                  id="signup-github"
                  type="text"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  placeholder="https://github.com/username or @username"
                  className="w-full rounded-xl border border-stone-700 bg-stone-900 py-2.5 pl-10 pr-3.5 text-xs sm:text-sm text-stone-100 placeholder:text-stone-500 focus:border-[#D93829] focus:outline-none focus:ring-1 focus:ring-[#D93829]"
                />
              </div>
            </div>

            {/* LeetCode URL */}
            <div>
              <label htmlFor="signup-leetcode" className="block text-xs font-semibold text-stone-300 mb-1">
                LeetCode Profile
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-500">
                  <Code2 className="h-4 w-4" />
                </span>
                <input
                  id="signup-leetcode"
                  type="url"
                  value={leetcodeUrl}
                  onChange={(e) => setLeetcodeUrl(e.target.value)}
                  placeholder="https://leetcode.com/u/username"
                  className="w-full rounded-xl border border-stone-700 bg-stone-900 py-2.5 pl-10 pr-3.5 text-xs sm:text-sm text-stone-100 placeholder:text-stone-500 focus:border-[#D93829] focus:outline-none focus:ring-1 focus:ring-[#D93829]"
                />
              </div>
            </div>

            {/* Step 2 Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center justify-center gap-1 rounded-xl border border-stone-700 bg-stone-900 px-4 py-3 text-xs sm:text-sm font-semibold text-stone-300 transition-colors hover:border-stone-600 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-xs sm:text-sm font-semibold text-white shadow-md shadow-red-950/40 transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account & Start Scoring</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Footer Switch to Login */}
      <div className="mt-6 border-t border-stone-800/80 pt-4 text-center">
        <p className="text-xs text-stone-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onToggleLogin}
            className="font-semibold text-[#D93829] hover:underline"
          >
            Sign in here &rarr;
          </button>
        </p>
      </div>
    </motion.div>
  );
}

export default SignUpWizard;
