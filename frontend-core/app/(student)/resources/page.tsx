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
    setSaving(true); setMessage(null);
    try {
      const changes: { resume_pdf_path?: string; linkedin_pdf_path?: string; updated_at: string } = { updated_at: new Date().toISOString() };
      if (resume) { const path = `${user.id}/resume.pdf`; const { error } = await supabase.storage.from('candidate-documents').upload(path, resume, { upsert: true, contentType: 'application/pdf' }); if (error) throw error; changes.resume_pdf_path = path; }
      if (linkedin) { const path = `${user.id}/linkedin.pdf`; const { error } = await supabase.storage.from('candidate-documents').upload(path, linkedin, { upsert: true, contentType: 'application/pdf' }); if (error) throw error; changes.linkedin_pdf_path = path; }
      const { error } = await supabase.from('profiles').update(changes).eq('id', user.id);
      if (error) throw error;
      setResume(null); setLinkedin(null); setMessage('Documents updated. Run the review again to refresh your analysis.');
      await hydrate(user.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Document replacement failed.'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & Documents" description="Read-only profile summary and secure replacement controls for the evidence used in your review." action={<Button asChild><Link href="/dashboard/profile"><Pencil className="mr-2 h-4 w-4" />Edit profile</Link></Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-panel rounded-2xl p-6"><h2 className="text-lg font-semibold">Candidate profile</h2><dl className="mt-5 space-y-4 text-sm"><Summary label="Full name" value={profile?.displayName} /><Summary label="Target role" value={profile?.targetRole} /><Summary label="Locations" value={profile?.targetLocations.join(', ')} /><Summary label="Skills" value={profile?.skills.join(', ')} /><Summary label="GitHub" value={profile?.githubUsername ? `github.com/${profile.githubUsername}` : undefined} /></dl><div className="mt-6 border-t border-white/10 pt-5"><h3 className="text-sm font-medium">Projects</h3><div className="mt-3 space-y-3">{profile?.projects.map((project) => <div key={project.id} className="rounded-xl border border-white/[0.07] p-3"><p className="font-medium">{project.name}</p><a href={project.repositoryUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center text-xs text-indigo-300">Repository<ExternalLink className="ml-1 h-3 w-3" /></a></div>)}</div></div></section>
        <section className="glass-panel rounded-2xl p-6"><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-indigo-300" /><h2 className="text-lg font-semibold">Private documents</h2></div><p className="mt-2 text-sm text-muted-foreground">Only private storage paths are saved to your profile.</p><div className="mt-5 space-y-4"><PdfDropzone label="Resume" file={resume} existingPath={profile?.resumePdfPath} progress={saving && resume ? 50 : 0} onChange={setResume} /><PdfDropzone label="LinkedIn profile export" file={linkedin} existingPath={profile?.linkedinPdfPath} progress={saving && linkedin ? 50 : 0} onChange={setLinkedin} /></div><Button className="mt-5 w-full" disabled={saving || (!resume && !linkedin)} onClick={() => void replaceDocuments()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save replacements</Button>{message && <p role="status" className="mt-3 text-sm text-indigo-200">{message}</p>}</section>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value?: string }) { return <div className="grid grid-cols-[120px_1fr] gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium text-slate-200">{value || 'Not supplied'}</dd></div>; }
