'use client';

import { useState, type FormEvent } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { BreakdownMeter } from '@/components/readiness/breakdown-meter';
import { READINESS_CATEGORY_LABELS, readinessTier } from '@/lib/dashboard-readiness';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { supabase } from '@/lib/supabase-client';
import { validatePdf, normalizeUsername } from '@/lib/onboarding';

type DocumentKind = 'resume' | 'linkedin';

function formatScoreUpdatedAt(value?: string): string {
  if (!value) return 'Waiting for the first completed analysis';
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return 'Update time unavailable';
  return `Last recalculated ${timestamp.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
}

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  const readiness = useProfileStore((state) => state.readiness);
  const isAnalyzing = useProfileStore((state) => state.isAnalyzing);
  const analyze = useProfileStore((state) => state.analyze);
  const hydrate = useProfileStore((state) => state.hydrate);
  const candidate = profile ?? user;

  const [displayName, setDisplayName] = useState(candidate?.displayName || '');
  const [targetRole, setTargetRole] = useState(candidate?.targetRole || 'Full-Stack Software Engineer');
  const [github, setGithub] = useState(candidate?.githubUsername || '');
  const [isSaving, setIsSaving] = useState(false);

  const [newResume, setNewResume] = useState<File | null>(null);
  const [newLinkedIn, setNewLinkedIn] = useState<File | null>(null);

  const selectDocument = (kind: DocumentKind, file: File): void => {
    const validationError = validatePdf(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (kind === 'resume') setNewResume(file);
    else setNewLinkedIn(file);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!user) return;

    const documentsChanged = Boolean(newResume || newLinkedIn);
    let profileSaved = false;
    setIsSaving(true);
    try {
      let resumePath = candidate?.resumePdfPath;
      let linkedinPath = candidate?.linkedinPdfPath;

      if (newResume) {
        const path = `${user.id}/resume.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('candidate-documents')
          .upload(path, newResume, { upsert: true, contentType: 'application/pdf' });
        if (uploadError) throw uploadError;
        resumePath = path;
      }

      if (newLinkedIn) {
        const path = `${user.id}/linkedin.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('candidate-documents')
          .upload(path, newLinkedIn, { upsert: true, contentType: 'application/pdf' });
        if (uploadError) throw uploadError;
        linkedinPath = path;
      }

      const { error: profileError } = await supabase.from('profiles').update({
        display_name: displayName.trim(),
        target_role: targetRole.trim(),
        github_username: normalizeUsername(github),
        resume_pdf_path: resumePath,
        linkedin_pdf_path: linkedinPath,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);

      if (profileError) throw profileError;
      profileSaved = true;

      if (documentsChanged) {
        const recalculated = await analyze(user.id);
        if (!recalculated) {
          throw new Error(useProfileStore.getState().error ?? 'The readiness service did not complete the score recalculation.');
        }
      } else {
        await hydrate(user.id);
        const refreshError = useProfileStore.getState().error;
        if (refreshError) throw new Error(refreshError);
      }

      setNewResume(null);
      setNewLinkedIn(null);
      toast.success(documentsChanged
        ? 'Profile saved and readiness scores recalculated.'
        : 'Candidate profile updated.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update profile.';
      toast.error(profileSaved && documentsChanged
        ? `Profile saved, but updated scores could not be confirmed: ${message}`
        : message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>VERIFIED MASTER CANDIDATE</span>
        </div>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Candidate Profile & Documents
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Manage your verified evidence, re-upload updated resumes, and sync career target goals.
        </p>
      </div>

      <section aria-labelledby="profile-readiness-heading" className="overflow-hidden rounded-3xl border border-indigo-400/20 bg-gradient-to-br from-[#111A2D]/95 via-[#101827]/90 to-[#0B1824]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5 border-b border-white/10 pb-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-200"><Gauge className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">Read-only score summary</p>
              <h2 id="profile-readiness-heading" className="mt-1 text-xl font-bold text-white">Current readiness scores</h2>
              <p className="mt-1 text-xs text-white/45">{formatScoreUpdatedAt(readiness?.updatedAt)}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-right">
            <p className="font-mono text-2xl font-black text-white">{Math.round(readiness?.totalScore ?? 0)}<span className="text-sm text-white/40">/100</span></p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-indigo-200">{readinessTier(readiness?.totalScore, readiness?.readinessLevel)}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">
          {READINESS_CATEGORY_LABELS.map(({ key, label }) => (
            <BreakdownMeter key={key} label={label} value={readiness?.breakdown[key]} />
          ))}
        </div>
        {isAnalyzing && <p className="mt-5 inline-flex items-center gap-2 text-xs text-cyan-200" role="status"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Recalculating and saving updated scores…</p>}
      </section>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Details Panel */}
        <div className="rounded-3xl border border-white/10 bg-[#101827]/80 p-6 shadow-xl backdrop-blur-2xl sm:p-8">
          <h2 className="font-[var(--font-display)] text-lg font-bold text-white">
            Personal & Career Goals
          </h2>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/70">
                Display Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                />
                <User className="pointer-events-none absolute right-4 top-3.5 h-4 w-4 text-white/30" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/70">
                Target Role
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/70">
                GitHub Handle / Profile
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                />
                <GitBranch className="pointer-events-none absolute right-4 top-3.5 h-4 w-4 text-white/30" />
              </div>
            </div>

          </div>
        </div>

        {/* Document Ingestion Re-upload Panel */}
        <div className="rounded-3xl border border-white/10 bg-[#101827]/80 p-6 shadow-xl backdrop-blur-2xl sm:p-8">
          <h2 className="font-[var(--font-display)] text-lg font-bold text-white">
            Document Ingestion & Proof of Work
          </h2>
          <p className="mt-1 text-xs text-white/50">
            Re-uploading new versions immediately recalculates your placement readiness score.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Resume Dropzone */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-white/70">
                Resume PDF (Active in copilot)
              </label>
              <div
                onClick={() => document.getElementById('profile-resume-input')?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5 transition-all hover:border-indigo-400/50 hover:bg-white/[0.04]"
              >
                <input
                  id="profile-resume-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) selectDocument('resume', file);
                    e.currentTarget.value = '';
                  }}
                />
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                  {newResume ? <FileCheck2 className="h-5 w-5 text-indigo-400" /> : <FileUp className="h-5 w-5" />}
                </div>
                <p className="mt-2 text-xs font-bold text-white">
                  {newResume ? newResume.name : 'Upload New Resume PDF'}
                </p>
                <p className="text-[10px] text-white/40">Max 10 MB • Re-indexes skill graph</p>
              </div>
            </div>

            {/* LinkedIn Dropzone */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-white/70">
                LinkedIn Export PDF
              </label>
              <div
                onClick={() => document.getElementById('profile-linkedin-input')?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5 transition-all hover:border-cyan-400/50 hover:bg-white/[0.04]"
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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                  {newLinkedIn ? <FileCheck2 className="h-5 w-5 text-cyan-400" /> : <FolderSync className="h-5 w-5" />}
                </div>
                <p className="mt-2 text-xs font-bold text-white">
                  {newLinkedIn ? newLinkedIn.name : 'Upload New LinkedIn PDF'}
                </p>
                <p className="text-[10px] text-white/40">Exports experience bullets</p>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving || isAnalyzing}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 px-7 py-3 font-[var(--font-display)] text-xs font-bold text-white shadow-[0_0_25px_rgba(99,102,241,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            <span>{isAnalyzing ? 'Recalculating Scores...' : isSaving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
