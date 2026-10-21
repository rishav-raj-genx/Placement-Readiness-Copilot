import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ExternalLink, FileCheck2 } from 'lucide-react';
import { createServerSessionClient } from '@/lib/supabase-session-server';
import { createSupabaseServiceClient } from '@/lib/supabase-service-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface AdminStudentProfilePageProps {
  params: { studentId: string };
}

interface StudentProject {
  id: string;
  title: string;
  description: string;
  repositoryUrl: string | null;
  liveUrl: string | null;
}

interface StudentProfileView {
  id: string;
  displayName: string;
  email: string;
  targetRole: string;
  targetLocations: string[];
  skills: string[];
  githubUrl: string | null;
  linkedinUrl: string | null;
  linkedinText: string;
  leetcodeUrl: string | null;
  codingProfileUrl: string | null;
  projects: StudentProject[];
  scores: Array<{ label: string; score: number }>;
  hasResume: boolean;
  hasLinkedinDocument: boolean;
  onboardingCompletedAt: string;
  createdAt: string;
  updatedAt: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
}

function readHttpUrl(value: unknown): string | null {
  const candidate = readString(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function profileUrl(value: unknown, prefix: string): string | null {
  const candidate = readString(value);
  if (!candidate) return null;
  return readHttpUrl(candidate) ?? `${prefix}${encodeURIComponent(candidate.replace(/^@/, ''))}`;
}

function normalizeProjects(value: unknown): StudentProject[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index): StudentProject[] => {
    if (!isRecord(item)) return [];
    const description = readString(item.description);
    const title = readString(item.title) || readString(item.name) || `Project ${index + 1}`;
    const repositoryUrl = readHttpUrl(
      item.repositoryUrl ?? item.repoUrl ?? item.githubUrl ?? item.repository_url,
    );
    const liveUrl = readHttpUrl(item.liveUrl ?? item.live_url);
    if (!description && !repositoryUrl && !liveUrl) return [];
    return [{
      id: readString(item.id) || `project-${index}`,
      title,
      description,
      repositoryUrl,
      liveUrl,
    }];
  });
}

function normalizeScores(value: unknown): Array<{ label: string; score: number }> {
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([label, rawScore]) => {
    const score = typeof rawScore === 'number' ? rawScore : Number(rawScore);
    if (!Number.isFinite(score)) return [];
    return [{
      label: label.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()),
      score: Math.min(100, Math.max(0, score)),
    }];
  });
}

function normalizeProfile(value: unknown): StudentProfileView | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  if (!id) return null;
  const githubIdentity = value.github_handle ?? value.github_username;
  return {
    id,
    displayName: readString(value.name) || readString(value.display_name) || 'Unnamed student',
    email: readString(value.email),
    targetRole: readString(value.target_role) || 'Not specified',
    targetLocations: readStringArray(value.target_locations),
    skills: readStringArray(value.skills),
    githubUrl: profileUrl(githubIdentity, 'https://github.com/'),
    linkedinUrl: readHttpUrl(value.linkedin_url),
    linkedinText: readString(value.linkedin_text),
    leetcodeUrl: readHttpUrl(value.leetcode_url),
    codingProfileUrl: readHttpUrl(value.coding_profile_url),
    projects: normalizeProjects(value.projects),
    scores: normalizeScores(value.scores),
    hasResume: Boolean(readString(value.resume_pdf_path)),
    hasLinkedinDocument: Boolean(readString(value.linkedin_pdf_path)),
    onboardingCompletedAt: readString(value.onboarding_completed_at),
    createdAt: readString(value.created_at),
    updatedAt: readString(value.updated_at),
  };
}

function formatDate(value: string): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

async function loadStudentProfile(studentId: string): Promise<StudentProfileView> {
  const sessionClient = createServerSessionClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) {
    redirect(`/auth?redirectTo=${encodeURIComponent(`/admin-students/${studentId}`)}`);
  }

  const { data: adminProfile, error: profileError } = await sessionClient
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();
  const adminProfileValue: unknown = adminProfile;
  if (profileError || !isRecord(adminProfileValue) || adminProfileValue.role !== 'admin') {
    redirect('/dashboard');
  }

  const serviceClient = createSupabaseServiceClient();
  const { data, error } = await serviceClient
    .from('profiles')
    .select([
      'id',
      'email',
      'display_name',
      'name',
      'role',
      'target_role',
      'target_locations',
      'skills',
      'github_username',
      'github_handle',
      'linkedin_url',
      'linkedin_text',
      'leetcode_url',
      'coding_profile_url',
      'projects',
      'scores',
      'resume_pdf_path',
      'linkedin_pdf_path',
      'onboarding_completed_at',
      'created_at',
      'updated_at',
    ].join(','))
    .eq('id', studentId)
    .eq('role', 'student')
    .maybeSingle();

  if (error) throw new Error('Student profile could not be loaded.');
  const normalized = normalizeProfile(data);
  if (!normalized) notFound();
  return normalized;
}

function ExternalProfileLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-xs font-medium text-stone-200 transition hover:border-orange-500/60 hover:text-orange-300"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

export default async function AdminStudentProfilePage({ params }: AdminStudentProfilePageProps) {
  const profile = await loadStudentProfile(params.studentId);
  const profileLinks = [
    profile.githubUrl ? { href: profile.githubUrl, label: 'GitHub' } : null,
    profile.linkedinUrl ? { href: profile.linkedinUrl, label: 'LinkedIn' } : null,
    profile.leetcodeUrl ? { href: profile.leetcodeUrl, label: 'LeetCode' } : null,
    profile.codingProfileUrl ? { href: profile.codingProfileUrl, label: 'Coding profile' } : null,
  ].filter((link): link is { href: string; label: string } => link !== null);

  return (
    <div className="space-y-6 pb-16">
      <Link
        href="/admin-interviews"
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-400 transition hover:text-orange-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to viva reviews
      </Link>

      <section className="rounded-2xl border border-stone-800 bg-stone-900 p-6 shadow-md shadow-black/40 sm:p-8">
        <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Student profile</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-100">{profile.displayName}</h1>
        <p className="mt-2 text-sm text-stone-400">{profile.email || profile.id}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {profileLinks.map((link) => (
            <ExternalProfileLink key={link.label} href={link.href} label={link.label} />
          ))}
          {profileLinks.length === 0 && (
            <p className="text-xs text-stone-500">No external profiles provided.</p>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-stone-800 bg-stone-900 p-5 shadow-md shadow-black/30">
            <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Placement target</p>
            <h2 className="mt-2 text-xl font-semibold text-stone-100">{profile.targetRole}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span key={skill} className="rounded-full border border-stone-700 bg-stone-950 px-2.5 py-1 text-xs text-stone-300">
                  {skill}
                </span>
              ))}
              {profile.skills.length === 0 && <p className="text-xs text-stone-500">No skills provided.</p>}
            </div>
            {profile.targetLocations.length > 0 && (
              <p className="mt-4 text-xs text-stone-400">
                Preferred locations: {profile.targetLocations.join(', ')}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-stone-800 bg-stone-900 p-5 shadow-md shadow-black/30">
            <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Projects</p>
            <div className="mt-4 space-y-3">
              {profile.projects.map((project) => (
                <article key={project.id} className="rounded-lg border border-stone-800 bg-stone-950/60 p-4">
                  <h3 className="text-sm font-semibold text-stone-100">{project.title}</h3>
                  {project.description && (
                    <p className="mt-2 text-xs leading-relaxed text-stone-400">{project.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    {project.repositoryUrl && (
                      <a className="text-orange-400 hover:text-orange-300" href={project.repositoryUrl} target="_blank" rel="noreferrer">
                        Repository
                      </a>
                    )}
                    {project.liveUrl && (
                      <a className="text-orange-400 hover:text-orange-300" href={project.liveUrl} target="_blank" rel="noreferrer">
                        Live project
                      </a>
                    )}
                  </div>
                </article>
              ))}
              {profile.projects.length === 0 && <p className="text-xs text-stone-500">No projects provided.</p>}
            </div>
          </section>

          {profile.linkedinText && (
            <section className="rounded-xl border border-stone-800 bg-stone-900 p-5 shadow-md shadow-black/30">
              <p className="font-mono text-xs uppercase tracking-wider text-orange-400">LinkedIn profile text</p>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-stone-300">{profile.linkedinText}</p>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-stone-800 bg-stone-900 p-5 shadow-md shadow-black/30">
            <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Readiness scores</p>
            <div className="mt-4 space-y-3">
              {profile.scores.map((score) => (
                <div key={score.label} className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-950/60 px-3 py-2.5">
                  <span className="text-xs text-stone-300">{score.label}</span>
                  <span className="font-mono text-sm font-bold text-stone-100">{Math.round(score.score)}/100</span>
                </div>
              ))}
              {profile.scores.length === 0 && <p className="text-xs text-stone-500">No readiness scores available.</p>}
            </div>
          </section>

          <section className="rounded-xl border border-stone-800 bg-stone-900 p-5 shadow-md shadow-black/30">
            <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Documents</p>
            <div className="mt-4 space-y-2.5">
              {[
                { label: 'Resume', available: profile.hasResume },
                { label: 'LinkedIn document', available: profile.hasLinkedinDocument },
              ].map((document) => (
                <div key={document.label} className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-950/60 px-3 py-2.5">
                  <span className="inline-flex items-center gap-2 text-xs text-stone-300">
                    <FileCheck2 className="h-3.5 w-3.5 text-stone-500" aria-hidden="true" />
                    {document.label}
                  </span>
                  <span className={document.available ? 'text-xs text-orange-400' : 'text-xs text-stone-500'}>
                    {document.available ? 'Uploaded' : 'Not provided'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-stone-800 bg-stone-900 p-5 shadow-md shadow-black/30">
            <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Profile metadata</p>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between gap-4"><dt className="text-stone-500">Onboarded</dt><dd className="text-right text-stone-300">{formatDate(profile.onboardingCompletedAt)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-stone-500">Created</dt><dd className="text-right text-stone-300">{formatDate(profile.createdAt)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-stone-500">Updated</dt><dd className="text-right text-stone-300">{formatDate(profile.updatedAt)}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
