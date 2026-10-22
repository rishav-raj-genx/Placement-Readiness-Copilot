'use client';

import { useState, useEffect, type FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  GitBranch,
  FolderSync,
  Save,
  ShieldCheck,
  FileCheck2,
  FileUp,
  Gauge,
  Loader2,
  Trash2,
  Edit3,
  Code2,
  ExternalLink,
  Plus,
  AlertTriangle,
  X,
  FileText,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { BreakdownMeter } from '@/components/readiness/breakdown-meter';
import { READINESS_CATEGORY_LABELS, readinessTier } from '@/lib/dashboard-readiness';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { supabase } from '@/lib/supabase-client';
import { validatePdf, validateResumeFile, normalizeUsername } from '@/lib/onboarding';
import { normalizeReadinessScore } from '@/lib/data-adapters';
import type { ProjectItem } from '@/types';

type DocumentKind = 'resume' | 'linkedin';

function formatScoreUpdatedAt(value?: string): string {
  if (!value) return 'Waiting for the first completed analysis';
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return 'Update time unavailable';
  return `Last recalculated ${timestamp.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  const readiness = useProfileStore((state) => state.readiness);
  const isAnalyzing = useProfileStore((state) => state.isAnalyzing);
  const hydrate = useProfileStore((state) => state.hydrate);
  const candidate = profile ?? user;

  const [displayName, setDisplayName] = useState('');
  const [targetRole, setTargetRole] = useState('Full-Stack Software Engineer');
  const [github, setGithub] = useState('');
  const [leetcodeUrl, setLeetcodeUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [linkedinText, setLinkedinText] = useState('');
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [newResume, setNewResume] = useState<File | null>(null);
  const [newLinkedIn, setNewLinkedIn] = useState<File | null>(null);

  // Modals & Inline Editors for "Manage Data"
  const [editingField, setEditingField] = useState<'github' | 'leetcode' | 'linkedinUrl' | 'linkedinText' | null>(null);
  const [fieldValueDraft, setFieldValueDraft] = useState('');

  // Project Modal State
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProjectIndex, setEditingProjectIndex] = useState<number | null>(null);
  const [verifyingProjectIndex, setVerifyingProjectIndex] = useState<number | null>(null);
  const [projectForm, setProjectForm] = useState<{
    title: string;
    repoUrl: string;
    liveUrl: string;
    description: string;
  }>({ title: '', repoUrl: '', liveUrl: '', description: '' });

  // Danger Zone Modal
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [hasSession, setHasSession] = useState(false);

  const resumeFileInputRef = useRef<HTMLInputElement>(null);
  const linkedinFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setHasSession(true);
        if (!user) {
          useAuthStore.getState().hydrate();
        }
      } else {
        setHasSession(false);
      }
    });
  }, [user]);

  useEffect(() => {
    if (candidate) {
      setDisplayName(candidate.displayName || '');
      setTargetRole(candidate.targetRole || 'Full-Stack Software Engineer');
      setGithub(candidate.githubUsername || '');
      setLeetcodeUrl(candidate.leetcodeUrl || '');
      setLinkedinUrl(candidate.linkedinUrl || '');
      setLinkedinText(candidate.linkedinText || '');
      setProjects(candidate.projects || []);
    }
  }, [candidate]);

  const selectDocument = (kind: DocumentKind, file: File): void => {
    const validationError = kind === 'resume' ? validateResumeFile(file) : validatePdf(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (kind === 'resume') setNewResume(file);
    else setNewLinkedIn(file);
  };

  // Direct Replace / Upload from "Manage Data"
  const handleDirectUploadDocument = async (kind: DocumentKind, file: File) => {
    if (!user) return;
    const validationError = kind === 'resume' ? validateResumeFile(file) : validatePdf(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const isDocx = file.name.toLowerCase().endsWith('.docx');
      const ext = kind === 'resume' ? (isDocx ? 'docx' : 'pdf') : 'pdf';
      const path = `${user.id}/${kind}.${ext}`;
      const contentType = isDocx
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';

      const { error: uploadError } = await supabase.storage
        .from('candidate-documents')
        .upload(path, file, { upsert: true, contentType });

      if (uploadError) throw uploadError;

      const columnToUpdate = kind === 'resume' ? 'resume_pdf_path' : 'linkedin_pdf_path';
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          [columnToUpdate]: path,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (dbError) throw dbError;

      await hydrate(user.id);
      toast.success(`${kind === 'resume' ? 'Resume' : 'LinkedIn document'} updated successfully.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Document upload failed.');
    }
  };

  // Direct Delete from "Manage Data"
  const handleDeleteDocument = async (kind: DocumentKind) => {
    if (!user) return;
    const currentPath = kind === 'resume' ? candidate?.resumePdfPath : candidate?.linkedinPdfPath;
    if (!currentPath) {
      toast.info('No document to delete.');
      return;
    }

    try {
      await supabase.storage.from('candidate-documents').remove([currentPath]);
      const columnToUpdate = kind === 'resume' ? 'resume_pdf_path' : 'linkedin_pdf_path';
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          [columnToUpdate]: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (dbError) throw dbError;

      if (kind === 'resume') setNewResume(null);
      else setNewLinkedIn(null);

      await hydrate(user.id);
      toast.success(`${kind === 'resume' ? 'Resume' : 'LinkedIn document'} deleted.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete document.');
    }
  };

  // Field Edit / Delete Handlers
  const openFieldEditor = (field: 'github' | 'leetcode' | 'linkedinUrl' | 'linkedinText') => {
    setEditingField(field);
    if (field === 'github') setFieldValueDraft(github);
    else if (field === 'leetcode') setFieldValueDraft(leetcodeUrl);
    else if (field === 'linkedinUrl') setFieldValueDraft(linkedinUrl);
    else if (field === 'linkedinText') setFieldValueDraft(linkedinText);
  };

  const saveFieldEditor = async () => {
    if (!user || !editingField) return;

    try {
      let dbColumn = '';
      let cleanVal: string | null = fieldValueDraft.trim();
      if (editingField === 'github') {
        dbColumn = 'github_username';
        cleanVal = cleanVal ? normalizeUsername(cleanVal) : null;
        setGithub(cleanVal || '');
      } else if (editingField === 'leetcode') {
        dbColumn = 'leetcode_url';
        cleanVal = cleanVal || null;
        setLeetcodeUrl(cleanVal || '');
      } else if (editingField === 'linkedinUrl') {
        dbColumn = 'linkedin_url';
        cleanVal = cleanVal || null;
        setLinkedinUrl(cleanVal || '');
      } else if (editingField === 'linkedinText') {
        dbColumn = 'linkedin_text';
        cleanVal = cleanVal || null;
        setLinkedinText(cleanVal || '');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          [dbColumn]: cleanVal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      await hydrate(user.id);
      setEditingField(null);
      toast.success('Information updated successfully.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleDeleteField = async (field: 'github' | 'leetcode' | 'linkedinUrl' | 'linkedinText') => {
    if (!user) return;
    try {
      const dbColumn =
        field === 'github'
          ? 'github_username'
          : field === 'leetcode'
            ? 'leetcode_url'
            : field === 'linkedinUrl'
              ? 'linkedin_url'
              : 'linkedin_text';

      const { error } = await supabase
        .from('profiles')
        .update({
          [dbColumn]: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      if (field === 'github') setGithub('');
      else if (field === 'leetcode') setLeetcodeUrl('');
      else if (field === 'linkedinUrl') setLinkedinUrl('');
      else if (field === 'linkedinText') setLinkedinText('');

      await hydrate(user.id);
      toast.success('Data point deleted.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete data point.');
    }
  };

  // Project Add / Edit / Delete Handlers
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

  const verifyLiveLink = async (project: ProjectItem, index?: number) => {
    if (!project.liveUrl) return;
    if (typeof index === 'number') setVerifyingProjectIndex(index);
    const toastId = toast.loading(`Verifying live demo for "${project.title || 'project'}"...`);
    try {
      const res = await fetch('/api/projects/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          liveUrl: project.liveUrl,
          projectName: project.title,
          description: project.description,
        }),
      });
      const checkResult = (await res.json()) as {
        passed?: boolean;
        qualityScore?: number;
        claimsMatched?: boolean;
        error?: string;
        recommendations?: string[];
      };
      if (res.ok && checkResult.passed) {
        toast.success(
          `Live link verified! Score: ${checkResult.qualityScore ?? 100}/100 (Claims matched)`,
          { id: toastId }
        );
      } else if (res.ok && !checkResult.passed) {
        const reason = checkResult.claimsMatched === false
          ? 'Live site content does not match project claims/tech stack.'
          : 'Live link check failed (unreachable, blank page, or low quality score).';
        toast.error(
          `${reason} (Quality score: ${checkResult.qualityScore ?? 0}/100)`,
          { id: toastId, duration: 6000 }
        );
      } else {
        toast.error(checkResult.error ?? 'Live link verification failed.', { id: toastId });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not verify live link at this time.', { id: toastId });
    } finally {
      if (typeof index === 'number') setVerifyingProjectIndex(null);
    }
  };

  const saveProjectModal = async () => {
    if (!user) return;
    if (!projectForm.title.trim() && !projectForm.description.trim()) {
      toast.error('Please provide a project title or description.');
      return;
    }

    const item: ProjectItem = {
      title: projectForm.title.trim() || 'Untitled Project',
      repoUrl: projectForm.repoUrl.trim() || undefined,
      githubUrl: projectForm.repoUrl.trim() || undefined,
      liveUrl: projectForm.liveUrl.trim() || undefined,
      description: projectForm.description.trim(),
    };

    let updatedList: ProjectItem[];
    if (editingProjectIndex !== null) {
      updatedList = [...projects];
      updatedList[editingProjectIndex] = item;
    } else {
      updatedList = [...projects, item];
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          projects: updatedList,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setProjects(updatedList);
      setIsProjectModalOpen(false);
      await hydrate(user.id);
      toast.success(editingProjectIndex !== null ? 'Project updated.' : 'Project added.');

      // Automatically run live-link check when project has a live URL
      if (item.liveUrl) {
        void verifyLiveLink(item);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save project.');
    }
  };

  const handleDeleteProject = async (index: number) => {
    if (!user) return;
    const updatedList = projects.filter((_, i) => i !== index);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          projects: updatedList,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      setProjects(updatedList);
      await hydrate(user.id);
      toast.success('Project deleted.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete project.');
    }
  };

  // Delete Account Action (invoking delete_user_account RPC)
  const handleDeleteAccount = async () => {
    if (confirmDeleteText !== 'DELETE') {
      toast.error('Please type DELETE to confirm account deletion.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;

      await useAuthStore.getState().signOut();
      toast.success('Your account and all associated data have been permanently deleted.');
      router.replace('/signin');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete account.';
      toast.error(message);
    } finally {
      setIsDeletingAccount(false);
      setIsDeleteAccountModalOpen(false);
    }
  };

  // Full Profile Form Save (Basic goals + document drops)
  const handleSave = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    let currentUser = user;
    if (!currentUser) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        currentUser = useAuthStore.getState().user;
        if (!currentUser) {
          useAuthStore.getState().hydrate();
          currentUser = useAuthStore.getState().user;
        }
      }
    }

    if (!currentUser) {
      toast.info('Please sign in or create an account to save your profile.');
      router.push('/auth?mode=login');
      return;
    }

    let profileSaved = false;
    setIsSaving(true);
    try {
      let resumePath = candidate?.resumePdfPath;
      let linkedinPath = candidate?.linkedinPdfPath;

      if (newResume) {
        const isDocx = newResume.name.toLowerCase().endsWith('.docx');
        const ext = isDocx ? 'docx' : 'pdf';
        const path = `${currentUser.id}/resume.${ext}`;
        const contentType = isDocx
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf';

        const { error: uploadError } = await supabase.storage
          .from('candidate-documents')
          .upload(path, newResume, { upsert: true, contentType });
        if (uploadError) throw uploadError;
        resumePath = path;
      }

      if (newLinkedIn) {
        const path = `${currentUser.id}/linkedin.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('candidate-documents')
          .upload(path, newLinkedIn, { upsert: true, contentType: 'application/pdf' });
        if (uploadError) throw uploadError;
        linkedinPath = path;
      }

      let updateSuccessful = false;
      try {
        const patchRes = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            displayName: displayName.trim(),
            targetRole: targetRole.trim(),
            githubUsername: normalizeUsername(github),
            leetcodeUrl: leetcodeUrl.trim() || null,
            linkedinUrl: linkedinUrl.trim() || null,
            linkedinText: linkedinText.trim() || null,
            projects: projects.length > 0 ? projects : null,
            resumePath,
            linkedinPath,
          }),
        });
        if (patchRes.ok) {
          updateSuccessful = true;
        }
      } catch {
        // Fallback to direct client Supabase query below
      }

      if (!updateSuccessful) {
        const fullPayload: Record<string, unknown> = {
          id: currentUser.id,
          email: currentUser.email,
          role: currentUser.role || 'student',
          display_name: displayName.trim(),
          target_role: targetRole.trim(),
          github_username: normalizeUsername(github),
          leetcode_url: leetcodeUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          linkedin_text: linkedinText.trim() || null,
          projects: projects.length > 0 ? projects : null,
          resume_pdf_path: resumePath,
          linkedin_pdf_path: linkedinPath,
          updated_at: new Date().toISOString(),
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(fullPayload, { onConflict: 'id' });

        if (profileError) {
          // If leetcode_url, linkedin_url or linkedin_text is not yet in the DB schema, retry without them
          const errStr = (profileError.message || '').toLowerCase();
          if (
            profileError.code === 'PGRST204' ||
            errStr.includes('leetcode_url') ||
            errStr.includes('linkedin_url') ||
            errStr.includes('linkedin_text') ||
            errStr.includes('column')
          ) {
            delete fullPayload.leetcode_url;
            delete fullPayload.linkedin_url;
            delete fullPayload.linkedin_text;
            const { error: retryError } = await supabase
              .from('profiles')
              .upsert(fullPayload, { onConflict: 'id' });
            if (retryError) throw retryError;
          } else {
            throw profileError;
          }
        }
      }

      profileSaved = true;

      // Automatically fire an asynchronous background request to /api/profile-review/analyze to calculate the new readiness score
      const currentUserId = currentUser.id;
      void (async () => {
        try {
          const internalKey = process.env.INTERNAL_SERVICE_KEY || process.env.NEXT_PUBLIC_INTERNAL_SERVICE_KEY || '';
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (internalKey) {
            headers['Authorization'] = `Bearer ${internalKey}`;
          }

          const response = await fetch('/api/profile-review/analyze', {
            method: 'POST',
            headers,
            body: JSON.stringify({ userId: currentUserId }),
          });

          if (response.ok) {
            const payload: unknown = await response.json().catch(() => null);
            if (typeof payload === 'object' && payload !== null && 'readiness' in payload) {
              const normalized = normalizeReadinessScore((payload as { readiness: unknown }).readiness);
              if (normalized) {
                useProfileStore.setState({ readiness: normalized });
              }
            }
          }
        } catch (err: unknown) {
          console.warn('AI scoring service re-index error bypassed:', err);
        } finally {
          await hydrate(currentUserId);
        }
      })();

      setNewResume(null);
      setNewLinkedIn(null);
      toast.success('Profile updated successfully.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update profile.';
      if (profileSaved) {
        toast.success('Profile updated successfully.');
      } else {
        toast.error(message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAllProfile = handleSave;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      {/* Hidden file inputs for direct replacement in Manage Data */}
      <input
        ref={resumeFileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) void handleDirectUploadDocument('resume', file);
          e.currentTarget.value = '';
        }}
      />
      <input
        ref={linkedinFileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) void handleDirectUploadDocument('linkedin', file);
          e.currentTarget.value = '';
        }}
      />

      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-400">
          <ShieldCheck className="h-3.5 w-3.5 text-orange-500" />
          <span>Verified candidate profile</span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-stone-100 sm:text-4xl">
          Candidate Profile & Evidence
        </h1>
        <p className="mt-1 text-sm text-stone-400">
          Manage your verified evidence, re-upload documents, configure coding profiles, and control your placement data.
        </p>
      </div>

      {!user && !hasSession && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-orange-500/30 bg-orange-950/30 p-4 text-xs text-stone-300">
          <div>
            <p className="font-semibold text-orange-400">Preview Mode — You are not signed in</p>
            <p className="mt-0.5 text-stone-400">Sign in to your account or register to save your profile changes and unlock full placement features.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/auth?mode=login')}
              className="rounded-lg border border-stone-700 bg-stone-900 px-3 py-1.5 font-medium text-stone-200 hover:border-stone-600 hover:text-white"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => router.push('/auth?mode=signup')}
              className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-500"
            >
              Create Account
            </button>
          </div>
        </div>
      )}

      {/* Current Readiness Scores Panel */}
      <section aria-labelledby="profile-readiness-heading" className="rounded-2xl border border-stone-800 bg-stone-900 p-6 shadow-md shadow-black/40 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5 border-b border-stone-800 pb-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-500">
              <Gauge className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-orange-400">Read-only score summary</p>
              <h2 id="profile-readiness-heading" className="mt-1 text-xl font-bold text-stone-100">Current readiness scores</h2>
              <p className="mt-1 text-xs text-stone-500">{formatScoreUpdatedAt(readiness?.updatedAt)}</p>
            </div>
          </div>
          <div className="rounded-xl border border-stone-800 bg-stone-950 px-4 py-3 text-right">
            <p className="font-mono text-2xl font-bold text-stone-100">
              {Math.round(readiness?.totalScore ?? 0)}
              <span className="text-sm text-stone-500">/100</span>
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-stone-400">
              {readinessTier(readiness?.totalScore, readiness?.readinessLevel)}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">
          {READINESS_CATEGORY_LABELS.map(({ key, label }) => (
            <BreakdownMeter key={key} label={label} value={readiness?.breakdown[key]} />
          ))}
        </div>
        {isAnalyzing && (
          <p className="mt-5 inline-flex items-center gap-2 text-xs text-stone-300" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" aria-hidden="true" />
            Recalculating and saving updated scores…
          </p>
        )}
      </section>

      {/* Main Profile Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Personal & Career Goals Panel */}
        <div className="rounded-2xl border border-stone-800 bg-stone-900 p-6 shadow-md shadow-black/40 sm:p-8">
          <h2 className="font-display text-lg font-bold text-stone-100">
            Personal & Career Goals
          </h2>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-stone-300">
                Display Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-stone-800 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/50"
                />
                <User className="pointer-events-none absolute right-4 top-3.5 h-4 w-4 text-stone-500" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-stone-300">
                Target Role
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full rounded-xl border border-stone-800 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-stone-300">
                GitHub Handle / Profile
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  className="w-full rounded-xl border border-stone-800 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/50"
                />
                <GitBranch className="pointer-events-none absolute right-4 top-3.5 h-4 w-4 text-stone-500" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-stone-300">
                LeetCode / Coding Profile URL
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={leetcodeUrl}
                  onChange={(e) => setLeetcodeUrl(e.target.value)}
                  placeholder="https://leetcode.com/u/yourhandle"
                  className="w-full rounded-xl border border-stone-800 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/50"
                />
                <Code2 className="pointer-events-none absolute right-4 top-3.5 h-4 w-4 text-stone-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Document Ingestion Re-upload Panel */}
        <div className="rounded-2xl border border-stone-800 bg-stone-900 p-6 shadow-md shadow-black/40 sm:p-8">
          <h2 className="font-display text-lg font-bold text-stone-100">
            Document Ingestion & Proof of Work
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Re-uploading new versions immediately recalculates your placement readiness score.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Resume Dropzone */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-stone-300">
                Resume PDF or DOCX (Active in copilot)
              </label>
              <div
                onClick={() => document.getElementById('profile-resume-input')?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-orange-500/30 bg-stone-950 p-5 transition-all hover:border-orange-500 hover:bg-orange-500/10 active:border-orange-500"
              >
                <input
                  id="profile-resume-input"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) selectDocument('resume', file);
                    e.currentTarget.value = '';
                  }}
                />
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                  {newResume ? <FileCheck2 className="h-5 w-5 text-orange-500" /> : <FileUp className="h-5 w-5 text-orange-500" />}
                </div>
                <p className="mt-2 text-xs font-semibold text-stone-100">
                  {newResume ? newResume.name : 'Upload New Resume (PDF / DOCX)'}
                </p>
                <p className="text-[10px] text-stone-500">Max 10 MB • Re-indexes skill graph</p>
              </div>
            </div>

            {/* LinkedIn Dropzone */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-stone-300">
                LinkedIn Export PDF
              </label>
              <div
                onClick={() => document.getElementById('profile-linkedin-input')?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-orange-500/30 bg-stone-950 p-5 transition-all hover:border-orange-500 hover:bg-orange-500/10 active:border-orange-500"
              >
                <input
                  id="profile-linkedin-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) selectDocument('linkedin', file);
                    e.currentTarget.value = '';
                  }}
                />
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                  {newLinkedIn ? <FileCheck2 className="h-5 w-5 text-orange-500" /> : <FolderSync className="h-5 w-5 text-orange-500" />}
                </div>
                <p className="mt-2 text-xs font-semibold text-stone-100">
                  {newLinkedIn ? newLinkedIn.name : 'Upload New LinkedIn PDF'}
                </p>
                <p className="text-[10px] text-stone-500">Exports experience bullets</p>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving || isAnalyzing}
            className="flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 px-7 py-3 text-xs font-bold text-white shadow-md shadow-black/40 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            <span>{isAnalyzing ? 'Recalculating Scores...' : isSaving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>

      {/* PHASE 2: COMPREHENSIVE MANAGE DATA SECTION */}
      <section aria-labelledby="manage-data-heading" className="rounded-2xl border border-stone-800 bg-stone-900/90 p-6 shadow-md shadow-black/40 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div>
            <h2 id="manage-data-heading" className="font-display text-xl font-bold text-stone-100">
              Manage Candidate Data
            </h2>
            <p className="mt-1 text-xs text-stone-400">
              Directly edit or delete active PDFs, parsed text, coding profiles, and linked projects.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Active Resume PDF / DOCX */}
          <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-200">Active Resume File</span>
                <span className={candidate?.resumePdfPath ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider' : 'text-stone-500 bg-stone-900/80 border border-stone-800 px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider'}>
                  {candidate?.resumePdfPath ? 'Active' : 'Missing'}
                </span>
              </div>
              <p className="mt-2 truncate text-xs text-stone-400 font-mono">
                {candidate?.resumePdfPath || 'No resume file currently linked'}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-stone-800/80 pt-3">
              <button
                type="button"
                onClick={() => resumeFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-700"
              >
                <Edit3 className="h-3 w-3" />
                <span>Edit / Replace</span>
              </button>
              <button
                type="button"
                disabled={!candidate?.resumePdfPath}
                onClick={() => void handleDeleteDocument('resume')}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>

          {/* Active LinkedIn PDF */}
          <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-200">Active LinkedIn PDF</span>
                <span className={candidate?.linkedinPdfPath ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider' : 'text-stone-500 bg-stone-900/80 border border-stone-800 px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider'}>
                  {candidate?.linkedinPdfPath ? 'Active' : 'Missing'}
                </span>
              </div>
              <p className="mt-2 truncate text-xs text-stone-400 font-mono">
                {candidate?.linkedinPdfPath || 'No LinkedIn PDF currently linked'}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-stone-800/80 pt-3">
              <button
                type="button"
                onClick={() => linkedinFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-700"
              >
                <Edit3 className="h-3 w-3" />
                <span>Edit / Replace</span>
              </button>
              <button
                type="button"
                disabled={!candidate?.linkedinPdfPath}
                onClick={() => void handleDeleteDocument('linkedin')}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>

          {/* Extracted / Pasted LinkedIn Text */}
          <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-200">Extracted / Pasted Bio Text</span>
                <span className={linkedinText ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider' : 'text-stone-500 bg-stone-900/80 border border-stone-800 px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider'}>
                  {linkedinText ? 'Present' : 'Empty'}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-stone-400">
                {linkedinText || 'No custom text or experience bullets provided.'}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-stone-800/80 pt-3">
              <button
                type="button"
                onClick={() => openFieldEditor('linkedinText')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-700"
              >
                <Edit3 className="h-3 w-3" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                disabled={!linkedinText}
                onClick={() => void handleDeleteField('linkedinText')}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>

          {/* LinkedIn Profile URL */}
          <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-200">LinkedIn Profile URL</span>
                <span className={linkedinUrl ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider' : 'text-stone-500 bg-stone-900/80 border border-stone-800 px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider'}>
                  {linkedinUrl ? 'Linked' : 'Not set'}
                </span>
              </div>
              <p className="mt-2 truncate text-xs text-stone-400 font-mono">
                {linkedinUrl || 'No LinkedIn profile connected'}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-stone-800/80 pt-3">
              <button
                type="button"
                onClick={() => openFieldEditor('linkedinUrl')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-700"
              >
                <Edit3 className="h-3 w-3" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                disabled={!linkedinUrl}
                onClick={() => void handleDeleteField('linkedinUrl')}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>

          {/* GitHub Coding Profile */}
          <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-200">GitHub Identity</span>
                <span className={github ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider' : 'text-stone-500 bg-stone-900/80 border border-stone-800 px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider'}>
                  {github ? 'Linked' : 'Not set'}
                </span>
              </div>
              <p className="mt-2 truncate text-xs text-stone-400 font-mono">
                {github ? `@${github}` : 'No GitHub profile connected'}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-stone-800/80 pt-3">
              <button
                type="button"
                onClick={() => openFieldEditor('github')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-700"
              >
                <Edit3 className="h-3 w-3" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                disabled={!github}
                onClick={() => void handleDeleteField('github')}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>

          {/* LeetCode / Coding Profile */}
          <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-4 flex flex-col justify-between sm:col-span-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-200">LeetCode / Coding Profile URL</span>
                <span className={leetcodeUrl ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider' : 'text-stone-500 bg-stone-900/80 border border-stone-800 px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider'}>
                  {leetcodeUrl ? 'Linked' : 'Not set'}
                </span>
              </div>
              <p className="mt-2 truncate text-xs text-stone-400 font-mono">
                {leetcodeUrl || 'No coding profile URL connected'}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-stone-800/80 pt-3">
              <button
                type="button"
                onClick={() => openFieldEditor('leetcode')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-700"
              >
                <Edit3 className="h-3 w-3" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                disabled={!leetcodeUrl}
                onClick={() => void handleDeleteField('leetcode')}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>

        {/* Parsed / Added Projects List in Manage Data */}
        <div className="border-t border-stone-800 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-stone-200">Parsed & Linked Projects</h3>
              <p className="text-xs text-stone-400">Projects linked to your portfolio graph and readiness evaluation.</p>
            </div>
            <button
              type="button"
              onClick={openAddProjectModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#D93829] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Project</span>
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {projects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-800 p-6 text-center text-xs text-stone-500">
                No parsed projects in database. Click &ldquo;Add Project&rdquo; to add your technical repos.
              </div>
            ) : (
              projects.map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-stone-800 bg-stone-900/70 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-stone-100">{item.title || item.name}</span>
                      {item.repoUrl && (
                        <a
                          href={item.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-stone-800 px-2 py-0.5 text-[10px] text-stone-300 hover:text-stone-100"
                        >
                          <GitBranch className="h-3 w-3" /> Repo
                        </a>
                      )}
                      {item.liveUrl && (
                        <a
                          href={item.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-stone-800 px-2 py-0.5 text-[10px] text-stone-300 hover:text-stone-100"
                        >
                          <ExternalLink className="h-3 w-3" /> Live
                        </a>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-stone-400">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {item.liveUrl && (
                      <button
                        type="button"
                        disabled={verifyingProjectIndex === idx}
                        onClick={() => void verifyLiveLink(item, idx)}
                        className="inline-flex items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-xs text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
                        title="Run live-link claims verification"
                      >
                        {verifyingProjectIndex === idx ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        Verify Link
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditProjectModal(idx)}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-700 bg-stone-800 px-2.5 py-1 text-xs text-stone-300 hover:bg-stone-700"
                    >
                      <Edit3 className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteProject(idx)}
                      className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Danger Zone: Delete Account */}
        <div className="mt-8 rounded-2xl border border-red-950/80 bg-red-950/20 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400">
                <ShieldAlert className="h-4 w-4" />
                <span>Danger Zone</span>
              </div>
              <h3 className="mt-1 text-base font-bold text-stone-100">Permanent Account Deletion</h3>
              <p className="mt-1 text-xs text-stone-400">
                Irreversibly delete your account, saved files, application tracking, and all interview records.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDeleteAccountModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-red-600 bg-red-600/20 px-4 py-2.5 text-xs font-bold text-red-300 transition-colors hover:bg-red-600 hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      </section>

      {/* Field Editor Modal */}
      {editingField && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-stone-900 p-6 shadow-md shadow-black/40">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-display text-base font-bold text-stone-100">
                {editingField === 'github'
                  ? 'Edit GitHub Handle'
                  : editingField === 'leetcode'
                    ? 'Edit LeetCode Profile URL'
                    : editingField === 'linkedinUrl'
                      ? 'Edit LinkedIn Profile URL'
                      : 'Edit Extracted / Bio Text'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="rounded p-1 text-stone-400 hover:text-stone-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              {editingField === 'linkedinText' ? (
                <textarea
                  value={fieldValueDraft}
                  onChange={(e) => setFieldValueDraft(e.target.value)}
                  rows={5}
                  placeholder="Paste or edit bio and experience bullets..."
                  className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2.5 text-xs text-stone-100 placeholder:text-stone-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              ) : (
                <input
                  type="text"
                  value={fieldValueDraft}
                  onChange={(e) => setFieldValueDraft(e.target.value)}
                  placeholder={
                    editingField === 'github'
                      ? 'octocat or github.com/octocat'
                      : editingField === 'linkedinUrl'
                        ? 'https://linkedin.com/in/username'
                        : 'https://leetcode.com/u/handle'
                  }
                  className="w-full rounded-xl border border-stone-800 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/50"
                />
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="rounded-lg border border-stone-800 bg-stone-900 px-4 py-2 text-xs font-semibold text-stone-300 hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveFieldEditor()}
                className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-500"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Modal (Add/Edit) */}
      {isProjectModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-stone-900 p-6 shadow-md shadow-black/40">
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
                  className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2.5 text-xs text-stone-100 focus:border-orange-500 focus:outline-none"
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
                  className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2.5 text-xs text-stone-100 focus:border-orange-500 focus:outline-none"
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
                  className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2.5 text-xs text-stone-100 focus:border-orange-500 focus:outline-none"
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
                  className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2.5 text-xs text-stone-100 placeholder:text-stone-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
                onClick={() => void saveProjectModal()}
                className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-500"
              >
                Save Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {isDeleteAccountModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-red-900 bg-stone-900 p-6 shadow-md shadow-black/40">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="font-display text-lg font-bold text-stone-100">Delete Account & Data</h3>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-stone-300">
              This action cannot be undone. All your uploaded resumes, parsed scores, application history, and interview recordings will be permanently purged via database cascade.
            </p>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-stone-400">
                To confirm, please type <span className="font-mono font-bold text-red-400">DELETE</span> below:
              </label>
              <input
                type="text"
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2.5 text-xs text-stone-100 focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setIsDeleteAccountModalOpen(false)}
                className="rounded-lg border border-stone-800 bg-stone-900 px-4 py-2 text-xs font-semibold text-stone-300 hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmDeleteText !== 'DELETE' || isDeletingAccount}
                onClick={() => void handleDeleteAccount()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-40"
              >
                {isDeletingAccount && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
