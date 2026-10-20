'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, Loader2, Pencil, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { PdfDropzone } from '@/components/onboarding/pdf-dropzone';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { supabase } from '@/lib/supabase-client';

export default function ResourcesPage() {
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  const hydrate = useProfileStore((state) => state.hydrate);
  const [resume, setResume] = useState<File | null>(null);
  const [linkedin, setLinkedin] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const replaceDocuments = async () => {
    if (!user || (!resume && !linkedin)) return;
    setSaving(true);
    setMessage(null);
    try {
      const changes: { resume_pdf_path?: string; linkedin_pdf_path?: string; updated_at: string } = {
        updated_at: new Date().toISOString(),
      };
      if (resume) {
        const path = `${user.id}/resume.pdf`;
        const { error } = await supabase.storage.from('candidate-documents').upload(path, resume, {
          upsert: true,
          contentType: 'application/pdf',
        });
        if (error) throw error;
        changes.resume_pdf_path = path;
      }
      if (linkedin) {
        const path = `${user.id}/linkedin.pdf`;
        const { error } = await supabase.storage.from('candidate-documents').upload(path, linkedin, {
          upsert: true,
          contentType: 'application/pdf',
        });
        if (error) throw error;
        changes.linkedin_pdf_path = path;
      }
      const { error } = await supabase.from('profiles').update(changes).eq('id', user.id);
      if (error) throw error;
      setResume(null);
      setLinkedin(null);
      setMessage('Documents updated. Run the review again to refresh your analysis.');
      await hydrate(user.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Document replacement failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile & documents"
        description="Read-only profile summary and secure replacement controls for the evidence used in your review."
        action={
          <Button
            asChild
            className="rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B]"
          >
            <Link href="/dashboard/profile">
              <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit profile
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-800 bg-[#28201E] p-6 text-stone-200">
          <h2 className="text-base font-semibold text-stone-100">Candidate profile</h2>
          <dl className="mt-4 space-y-3 text-xs sm:text-sm">
            <Summary label="Full name" value={profile?.displayName} />
            <Summary label="Target role" value={profile?.targetRole} />
            <Summary label="Locations" value={profile?.targetLocations.join(', ')} />
            <Summary label="Skills" value={profile?.skills.join(', ')} />
            <Summary label="GitHub" value={profile?.githubUsername ? `github.com/${profile.githubUsername}` : undefined} />
          </dl>
          <div className="mt-6 border-t border-stone-800 pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">Projects</h3>
            <div className="mt-3 space-y-2">
              {profile?.projects.map((project) => (
                <div key={project.id} className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
                  <p className="text-sm font-medium text-stone-200">{project.name}</p>
                  <a
                    href={project.repositoryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center text-xs font-medium text-[#D93829] hover:underline"
                  >
                    Repository<ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-800 bg-[#28201E] p-6 text-stone-200">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#D93829]" />
            <h2 className="text-base font-semibold text-stone-100">Private documents</h2>
          </div>
          <p className="mt-1 text-xs text-stone-400">Only private storage paths are saved to your profile.</p>
          <div className="mt-5 space-y-4">
            <PdfDropzone
              label="Resume"
              file={resume}
              existingPath={profile?.resumePdfPath}
              progress={saving && resume ? 50 : 0}
              onChange={setResume}
            />
            <PdfDropzone
              label="LinkedIn profile export"
              file={linkedin}
              existingPath={profile?.linkedinPdfPath}
              progress={saving && linkedin ? 50 : 0}
              onChange={setLinkedin}
            />
          </div>
          <Button
            className="mt-5 w-full rounded-lg bg-[#D93829] text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B] disabled:opacity-50"
            disabled={saving || (!resume && !linkedin)}
            onClick={() => void replaceDocuments()}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save replacements
          </Button>
          {message && (
            <p role="status" className="mt-3 rounded-lg border border-stone-700 bg-stone-800/80 p-3 text-xs text-stone-300">
              {message}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4">
      <dt className="text-stone-400">{label}</dt>
      <dd className="font-medium text-stone-200">{value || 'Not supplied'}</dd>
    </div>
  );
}
