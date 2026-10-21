'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Circle,
  FileText,
  Loader2,
  Lock,
  Mail,
  Paperclip,
  Send,
  Sparkles,
  User,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import clsx from 'clsx';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import {
  normalizeGithubUsername,
  signupAccountSchema,
  type SignupAccountValues,
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
import { getAuthErrorMessage } from '@/lib/auth-errors';
import { parseConversationalIntent } from '@/lib/intake-intent';
import type { ProjectItem } from '@/types';

export interface SignUpWizardProps {
  onToggleLogin: () => void;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
  fileAttachment?: {
    name: string;
    type: 'resume' | 'linkedin';
  };
  pillUpdate?: string;
}

const EMPTY_ACCOUNT: SignupAccountValues = { fullName: '', email: '', password: '' };

const QUICK_PROMPTS = [
  'Here is my GitHub: https://github.com/rishav-raj-genx',
  'Targeting Full Stack Engineer roles',
  'My LeetCode is https://leetcode.com/u/candidate',
  'I built an AI chatbot with Next.js & Python at https://github.com/demo/repo',
];

export function SignUpWizard({ onToggleLogin }: SignUpWizardProps) {
  const router = useRouter();
  const hydrate = useAuthStore((state) => state.hydrate);

  // Identity & Credentials
  const [identity, setIdentity] = useState<{ id: string; email: string } | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  // Profile data
  const [targetRole, setTargetRole] = useState('');
  const [github, setGithub] = useState('');
  const [leetcodeUrl, setLeetcodeUrl] = useState('');
  const [linkedinText, setLinkedinText] = useState('');
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumePath, setResumePath] = useState<string | null>(null);
  const [linkedinFile, setLinkedinFile] = useState<File | null>(null);
  const [linkedinPath, setLinkedinPath] = useState<string | null>(null);

  // Chat UI state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const accountForm = useForm<SignupAccountValues>({
    resolver: zodResolver(signupAccountSchema),
    defaultValues: EMPTY_ACCOUNT,
    mode: 'onTouched',
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAssistantTyping]);

  // Initial restoration of draft & session
  useEffect(() => {
    let active = true;

    const restore = async () => {
      try {
        const [draft, documents] = await Promise.all([
          Promise.resolve(loadPendingSignupDraft()),
          loadPendingSignupDocuments(),
        ]);
        if (!active) return;

        if (documents.resume) setResumeFile(documents.resume);
        if (documents.linkedin) setLinkedinFile(documents.linkedin);

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
          setAccountCreated(true);

          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, target_role, github_username, leetcode_url, linkedin_text, projects, resume_pdf_path, linkedin_pdf_path')
            .eq('id', authUser.id)
            .maybeSingle();

          if (!active) return;

          if (profile) {
            if (profile.display_name) setDisplayName(profile.display_name);
            if (profile.target_role) setTargetRole(profile.target_role);
            if (profile.github_username) setGithub(profile.github_username);
            if (profile.leetcode_url) setLeetcodeUrl(profile.leetcode_url);
            if (profile.linkedin_text) setLinkedinText(profile.linkedin_text);
            if (profile.projects && Array.isArray(profile.projects)) setProjects(profile.projects);
            if (profile.resume_pdf_path) setResumePath(profile.resume_pdf_path);
            if (profile.linkedin_pdf_path) setLinkedinPath(profile.linkedin_pdf_path);
          }
        } else if (draft) {
          if (draft.displayName) setDisplayName(draft.displayName);
          if (draft.targetRole) setTargetRole(draft.targetRole);
          if (draft.githubUsername) setGithub(draft.githubUsername);
          if (draft.leetcodeUrl) setLeetcodeUrl(draft.leetcodeUrl);
          if (draft.linkedinText) setLinkedinText(draft.linkedinText);
          if (draft.projects && draft.projects.length > 0) setProjects(draft.projects);
          accountForm.reset({ fullName: draft.displayName, email: draft.email, password: '' });
        }

        // Initialize greeting message
        const initialGreeting: ChatMessage = {
          id: 'welcome-1',
          role: 'assistant',
          content: `Hi there! 👋 I am your Placement Readiness Copilot.\n\nI will help you benchmark your resume, connect your GitHub code, and get you ready for technical vivas.\n\nYou can chat with me naturally: paste your GitHub profile URL, upload your resume (.pdf or .docx), share your target role, or describe your projects. Where would you like to start?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages([initialGreeting]);
      } catch {
        // Fallback gracefully
      }
    };

    void restore();

    return () => {
      active = false;
    };
  }, [accountForm]);

  // Persist Profile Record to Supabase and Local Draft in real-time
  const updateProfileInDatabase = async (updates: {
    targetRole?: string;
    github?: string;
    leetcodeUrl?: string;
    linkedinText?: string;
    projects?: ProjectItem[];
    resumePath?: string;
    linkedinPath?: string;
    displayName?: string;
  }) => {
    const nextRole = updates.targetRole ?? targetRole;
    const nextGithub = updates.github !== undefined ? updates.github : github;
    const nextLeetcode = updates.leetcodeUrl !== undefined ? updates.leetcodeUrl : leetcodeUrl;
    const nextLinkedinText = updates.linkedinText !== undefined ? updates.linkedinText : linkedinText;
    const nextProjects = updates.projects !== undefined ? updates.projects : projects;
    const nextResumePath = updates.resumePath !== undefined ? updates.resumePath : resumePath;
    const nextLinkedinPath = updates.linkedinPath !== undefined ? updates.linkedinPath : linkedinPath;
    const nextName = updates.displayName !== undefined ? updates.displayName : displayName;

    // Persist draft locally
    const draft: PendingSignupDraft = {
      displayName: nextName,
      email: identity?.email ?? accountForm.getValues('email') ?? '',
      targetRole: nextRole,
      githubUsername: nextGithub,
      leetcodeUrl: nextLeetcode,
      linkedinText: nextLinkedinText,
      projects: nextProjects,
    };
    savePendingSignupDraft(draft);

    // If user is authenticated, update database record in real-time
    if (isSupabaseConfigured && identity?.id) {
      try {
        await supabase.from('profiles').upsert({
          id: identity.id,
          role: 'student',
          display_name: nextName || 'Candidate',
          target_role: nextRole || 'Software Engineer',
          github_username: nextGithub ? normalizeGithubUsername(nextGithub) : null,
          leetcode_url: nextLeetcode.trim() || null,
          linkedin_text: nextLinkedinText.trim() || null,
          projects: nextProjects.length > 0 ? nextProjects : null,
          resume_pdf_path: nextResumePath || null,
          linkedin_pdf_path: nextLinkedinPath || null,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Ignored; local state preserves progress
      }
    }
  };

  // Create initial account credentials if unauthenticated
  const handleCreateAccount = accountForm.handleSubmit(async (values) => {
    setIsCreatingAccount(true);
    try {
      if (!isSupabaseConfigured) {
        setIdentity({ id: 'local-preview-user', email: values.email });
        setDisplayName(values.fullName);
        setAccountCreated(true);
        toast.success('Account configured. Welcome!');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            display_name: values.fullName,
            role: 'student',
          },
        },
      });

      if (error) {
        throw new Error(getAuthErrorMessage(error, 'sign_up'));
      }

      if (data.user && !data.session) {
        setConfirmationEmail(values.email);
        return;
      }

      if (data.user) {
        setIdentity({ id: data.user.id, email: values.email });
        setDisplayName(values.fullName);
        setAccountCreated(true);
        toast.success('Account created! Conversational assistant unlocked.');

        // Initial sync of profile record
        await supabase.from('profiles').upsert({
          id: data.user.id,
          role: 'student',
          display_name: values.fullName,
          target_role: targetRole || 'Software Engineer',
          github_username: github ? normalizeGithubUsername(github) : null,
          leetcode_url: leetcodeUrl.trim() || null,
          linkedin_text: linkedinText.trim() || null,
          projects: projects.length > 0 ? projects : null,
          resume_pdf_path: resumePath || null,
          linkedin_pdf_path: linkedinPath || null,
          updated_at: new Date().toISOString(),
        });

        // Add welcome message
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Welcome, ${values.fullName}! 🎉 Your account is set up. You can now send me your GitHub profile, upload your resume, or share your target role.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create account.';
      toast.error(msg);
    } finally {
      setIsCreatingAccount(false);
    }
  });

  // Handle file uploads directly in chat
  const handleFileUpload = async (file: File) => {
    const error = validateResumeFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    const userMsgId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        content: `Uploaded resume: ${file.name} 📄`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fileAttachment: { name: file.name, type: 'resume' },
      },
    ]);

    setResumeFile(file);
    await savePendingSignupDocuments({ resume: file, linkedin: linkedinFile });

    let uploadedPath = resumePath;
    if (isSupabaseConfigured && identity?.id) {
      try {
        const isDocx = file.name.toLowerCase().endsWith('.docx');
        const ext = isDocx ? 'docx' : 'pdf';
        const contentType = isDocx
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf';
        const path = `${identity.id}/resume.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('candidate-documents')
          .upload(path, file, { upsert: true, contentType });

        if (!uploadError) {
          uploadedPath = path;
          setResumePath(path);
        }
      } catch {
        // Storage upload fallback
      }
    }

    await updateProfileInDatabase({ resumePath: uploadedPath ?? undefined });

    setMessages((prev) => [
      ...prev,
      {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Awesome! I've linked your resume **${file.name}** to your profile ✅.\n\nOur Review Engine will check for 1-page length, ATS friendliness, quantifiable metrics, and tech stack alignment. What role or GitHub profile would you like to link next?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pillUpdate: 'Resume ✅',
      },
    ]);
  };

  // Handle sending a message in the conversational chat
  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputMessage).trim();
    if (!content || isAssistantTyping) return;

    setInputMessage('');
    const userMsgId = Date.now().toString();

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setIsAssistantTyping(true);

    try {
      const result = await parseConversationalIntent(content, {
        targetRole,
        github,
        leetcodeUrl,
        linkedinText,
        resumePath,
        projectsCount: projects.length,
      });

      const { extracted, reply } = result;
      const updates: {
        targetRole?: string;
        github?: string;
        leetcodeUrl?: string;
        linkedinText?: string;
        displayName?: string;
        projects?: ProjectItem[];
      } = {};

      if (extracted.displayName && !displayName) {
        setDisplayName(extracted.displayName);
        updates.displayName = extracted.displayName;
      }
      if (extracted.targetRole) {
        setTargetRole(extracted.targetRole);
        updates.targetRole = extracted.targetRole;
      }
      if (extracted.github) {
        setGithub(extracted.github);
        updates.github = extracted.github;
      }
      if (extracted.leetcodeUrl) {
        setLeetcodeUrl(extracted.leetcodeUrl);
        updates.leetcodeUrl = extracted.leetcodeUrl;
      }
      if (extracted.linkedinText || extracted.linkedinUrl) {
        const textVal = extracted.linkedinText || `LinkedIn: ${extracted.linkedinUrl}`;
        setLinkedinText(textVal);
        updates.linkedinText = textVal;
      }
      if (extracted.project) {
        const nextList = [...projects, extracted.project];
        setProjects(nextList);
        updates.projects = nextList;
      }

      if (Object.keys(updates).length > 0) {
        await updateProfileInDatabase(updates);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I've saved your input! You can also paste your GitHub profile URL or upload your resume (.pdf or .docx) below.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAssistantTyping(false);
    }
  };

  // Bypass: Ensure user can click "Go to Dashboard" at any time
  const handleBypassToDashboard = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      let userId = identity?.id;

      if (!userId) {
        if (!isSupabaseConfigured) {
          userId = 'local-preview-user';
        } else {
          const formValues = accountForm.getValues();
          if (formValues.email && formValues.password) {
            const { data, error } = await supabase.auth.signUp({
              email: formValues.email,
              password: formValues.password,
              options: {
                data: {
                  display_name: formValues.fullName || 'Candidate',
                  role: 'student',
                },
              },
            });
            if (error) throw new Error(getAuthErrorMessage(error, 'sign_up'));
            userId = data.user?.id;
          } else {
            toast.info('Opening candidate dashboard…');
            router.replace('/dashboard');
            return;
          }
        }
      }

      if (isSupabaseConfigured && userId && userId !== 'local-preview-user') {
        await supabase.from('profiles').upsert({
          id: userId,
          role: 'student',
          display_name: displayName || 'Candidate',
          target_role: targetRole || 'Software Engineer',
          github_username: github ? normalizeGithubUsername(github) : null,
          leetcode_url: leetcodeUrl.trim() || null,
          linkedin_text: linkedinText.trim() || null,
          projects: projects.length > 0 ? projects : null,
          resume_pdf_path: resumePath || null,
          linkedin_pdf_path: linkedinPath || null,
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      await clearPendingSignup();
      if (userId && isSupabaseConfigured) hydrate();

      toast.success('Profile saved! Opening your readiness dashboard.');
      router.replace('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to complete dashboard navigation.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

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
          We sent a confirmation link to <strong className="text-stone-200">{confirmationEmail}</strong>. Your profile data is saved and will resume once verified.
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
      className="flex w-full max-w-2xl flex-col rounded-2xl border border-stone-800 bg-[#28201E] text-stone-200 shadow-xl shadow-black/50"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-stone-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-700 bg-stone-900 text-[#D93829]">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-[var(--font-display)] text-sm font-bold text-stone-100">
                Conversational Intake Assistant
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-[11px] text-stone-400">
              Share details in any order — your profile updates in real-time
            </p>
          </div>
        </div>

        {/* Bypass Button: Always visible and clickable */}
        <button
          type="button"
          onClick={handleBypassToDashboard}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#D93829]/60 bg-[#D93829]/10 px-3 py-1.5 text-xs font-semibold text-[#D93829] transition-all hover:bg-[#D93829] hover:text-white disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
          <span>Go to Dashboard</span>
        </button>
      </div>

      {/* Live Status Pills Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-800 bg-stone-900/60 px-5 py-2.5">
        <div className="mr-1 text-[11px] font-mono uppercase tracking-wider text-stone-500">
          Collected:
        </div>
        <StatusPill
          label="Resume"
          isComplete={Boolean(resumeFile || resumePath)}
          detail={resumeFile ? resumeFile.name : resumePath ? 'Attached' : undefined}
        />
        <StatusPill
          label="GitHub"
          isComplete={Boolean(github)}
          detail={github ? `@${github}` : undefined}
        />
        <StatusPill
          label="Role"
          isComplete={Boolean(targetRole)}
          detail={targetRole || undefined}
        />
        <StatusPill
          label="Projects"
          isComplete={projects.length > 0}
          detail={projects.length > 0 ? `${projects.length}` : undefined}
        />
        <StatusPill
          label="LinkedIn"
          isComplete={Boolean(linkedinFile || linkedinPath || linkedinText)}
        />
        <StatusPill
          label="Coding Profile"
          isComplete={Boolean(leetcodeUrl)}
        />
      </div>

      {/* Account Setup Card if user is not yet signed up */}
      {!identity && !accountCreated && (
        <div className="border-b border-stone-800 bg-stone-900/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-300">
              Set up credentials to persist your profile
            </span>
            <button
              type="button"
              onClick={onToggleLogin}
              className="text-xs text-[#D93829] hover:underline"
            >
              Already have an account? Log in
            </button>
          </div>
          <form onSubmit={handleCreateAccount} className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <input
              {...accountForm.register('fullName')}
              placeholder="Full name"
              className="rounded-lg border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:border-[#D93829] focus:outline-none"
            />
            <input
              {...accountForm.register('email')}
              type="email"
              placeholder="Email address"
              className="rounded-lg border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:border-[#D93829] focus:outline-none"
            />
            <div className="flex gap-1.5">
              <input
                {...accountForm.register('password')}
                type="password"
                placeholder="Password (8+ chars)"
                className="w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:border-[#D93829] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isCreatingAccount}
                className="shrink-0 rounded-lg bg-[#D93829] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#c03023] disabled:opacity-50"
              >
                {isCreatingAccount ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Chat Messages Scroll Container */}
      <div className="flex flex-1 flex-col space-y-3 overflow-y-auto p-5 max-h-[420px] min-h-[300px]">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={clsx('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}
            >
              <div
                className={clsx(
                  'max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed sm:text-sm shadow-sm',
                  msg.role === 'user'
                    ? 'rounded-br-xs bg-[#D93829] text-white'
                    : 'rounded-bl-xs border border-stone-800 bg-stone-900/90 text-stone-200'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-stone-400">
                    <Bot className="h-3 w-3 text-[#D93829]" />
                    <span>Placement Copilot</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
                <span className="mt-1 block text-[10px] opacity-60 text-right">
                  {msg.timestamp}
                </span>
              </div>
            </motion.div>
          ))}

          {isAssistantTyping && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-xl border border-stone-800 bg-stone-900/80 px-3 py-2 text-xs text-stone-400"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D93829]" />
              <span>Analyzing intent & updating profile...</span>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Chips */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-stone-800/80 bg-stone-900/40 px-5 py-2">
        <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">Try:</span>
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => void handleSendMessage(prompt)}
            className="rounded-full border border-stone-800 bg-stone-900/80 px-2.5 py-1 text-[11px] text-stone-300 transition-colors hover:border-stone-700 hover:text-stone-100"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Input & File Attachment Bar */}
      <div className="border-t border-stone-800 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          {/* Hidden File Input for PDF/DOCX */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleFileUpload(file);
                e.target.value = '';
              }
            }}
          />

          {/* Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach Resume (.pdf or .docx)"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-700 bg-stone-900 text-stone-400 transition-colors hover:border-stone-600 hover:text-stone-100"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your details (e.g., 'Here is my GitHub...', 'Targeting SDE')..."
            className="h-10 flex-1 rounded-xl border border-stone-700 bg-stone-900 px-4 text-xs sm:text-sm text-stone-100 placeholder:text-stone-500 focus:border-[#D93829] focus:outline-none"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputMessage.trim() || isAssistantTyping}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D93829] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-2 flex items-center justify-between text-[11px] text-stone-500">
          <span>Supported attachments: Resume (.pdf, .docx up to 10 MB)</span>
          <button
            type="button"
            onClick={onToggleLogin}
            className="text-stone-400 hover:text-stone-200"
          >
            Switch to regular login
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function StatusPill({
  label,
  isComplete,
  detail,
}: {
  label: string;
  isComplete: boolean;
  detail?: string;
}) {
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
        isComplete
          ? 'border border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
          : 'border border-stone-800 bg-stone-900/40 text-stone-400'
      )}
    >
      {isComplete ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
      ) : (
        <Circle className="h-3 w-3 text-stone-600 shrink-0" />
      )}
      <span>{label}</span>
      {isComplete && detail ? (
        <span className="max-w-[120px] truncate text-emerald-400/80">({detail})</span>
      ) : null}
      {isComplete ? <span className="font-bold text-emerald-400">✅</span> : null}
    </div>
  );
}

export default SignUpWizard;
