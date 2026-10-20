'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { SkillsCombobox } from '@/components/admin/SkillsCombobox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase-client';
import type { MsotJobWithApplicants } from '@/lib/msot-jobs';
import type { DiscoveredJob } from '@/types';

interface AdminJobsWorkspaceProps {
  jobs: MsotJobWithApplicants[];
  loadError: string | null;
}

interface JobFormState {
  title: string;
  company: string;
  location: string;
  applicationUrl: string;
  employmentType: DiscoveredJob['employment_type'];
  requiredSkills: string[];
  description: string;
}

const INITIAL_FORM: JobFormState = {
  title: '',
  company: 'MSOT Partner',
  location: '',
  applicationUrl: '',
  employmentType: 'full_time',
  requiredSkills: [],
  description: '',
};

const EMPLOYMENT_LABELS: Record<DiscoveredJob['employment_type'], string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  internship: 'Internship',
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatDate(value: string): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'CA';
}

export function AdminJobsWorkspace({ jobs, loadError }: AdminJobsWorkspaceProps) {
  const router = useRouter();
  const [form, setForm] = useState<JobFormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalApplicants = useMemo(
    () => jobs.reduce((total, job) => total + job.applicants.length, 0),
    [jobs],
  );

  const updateField = <Key extends keyof JobFormState,>(key: Key, value: JobFormState[Key]): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isSubmitting) return;

    const title = form.title.trim();
    const company = form.company.trim();
    const location = form.location.trim();
    const description = form.description.trim();
    const applicationUrl = form.applicationUrl.trim();

    if (!title || !company || !location || !description) {
      toast.error('Title, company, location, and description are required.');
      return;
    }
    if (!isHttpUrl(applicationUrl)) {
      toast.error('Enter a valid HTTP or HTTPS application URL.');
      return;
    }
    if (form.requiredSkills.length === 0) {
      toast.error('Add at least one required skill.');
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();
    const id = `msot-${crypto.randomUUID()}`;

    try {
      const { error } = await supabase.from('discovered_jobs').insert({
        id,
        title,
        company,
        location,
        url: applicationUrl,
        source: 'msot',
        description,
        required_skills: form.requiredSkills,
        matched_skills: [],
        relevance_score: 0,
        match_reason: 'Official opportunity published by the MSOT placement team.',
        is_remote: /\bremote\b/i.test(location),
        job_type: form.employmentType,
        employment_type: form.employmentType,
        publication_status: 'published',
        is_msot_post: true,
        posted_at: now,
        updated_at: now,
      });
      if (error) throw error;

      setForm(INITIAL_FORM);
      toast.success('MSOT job published to the student feed.');
      router.refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to publish the MSOT job.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <section className="relative overflow-hidden rounded-[2rem] border border-violet-300/15 bg-white/[0.035] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-9">
        <div aria-hidden="true" className="absolute -right-28 -top-32 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200">Official opportunities</p>
            <h1 className="mt-2 font-[var(--font-display)] text-3xl font-black tracking-tight text-white sm:text-5xl">MSOT Job Board</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50">Publish verified partner roles directly to the top of every eligible student’s discovery feed.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-violet-300/15 bg-violet-400/[0.07] px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Active posts</p>
              <p className="mt-1 text-2xl font-black text-violet-100">{jobs.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.07] px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Applicants</p>
              <p className="mt-1 text-2xl font-black text-amber-100">{totalApplicants}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={(event) => void handleSubmit(event)} className="rounded-[1.75rem] border border-violet-300/15 bg-[#111522]/85 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600/30 to-amber-400/15 text-amber-200">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-white">Post an official role</h2>
              <p className="mt-1 text-xs leading-relaxed text-white/40">Published immediately with MSOT priority.</p>
            </div>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="job-title" className="text-xs text-white/65">Job title</Label>
              <input id="job-title" value={form.title} onChange={(event) => updateField('title', event.target.value)} disabled={isSubmitting} placeholder="Graduate Software Engineer" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-300/45 focus:ring-2 focus:ring-violet-400/15" />
            </div>
            <div>
              <Label htmlFor="job-company" className="text-xs text-white/65">Company</Label>
              <input id="job-company" value={form.company} onChange={(event) => updateField('company', event.target.value)} disabled={isSubmitting} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 text-sm text-white outline-none focus:border-violet-300/45 focus:ring-2 focus:ring-violet-400/15" />
            </div>
            <div>
              <Label htmlFor="job-location" className="text-xs text-white/65">Location</Label>
              <input id="job-location" value={form.location} onChange={(event) => updateField('location', event.target.value)} disabled={isSubmitting} placeholder="Remote · India" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-300/45 focus:ring-2 focus:ring-violet-400/15" />
            </div>
            <div>
              <Label htmlFor="job-employment" className="text-xs text-white/65">Employment type</Label>
              <select id="job-employment" value={form.employmentType} onChange={(event) => updateField('employmentType', event.target.value as DiscoveredJob['employment_type'])} disabled={isSubmitting} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#0B0F17] px-3.5 text-sm text-white outline-none focus:border-violet-300/45 focus:ring-2 focus:ring-violet-400/15">
                {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="job-url" className="text-xs text-white/65">Application URL</Label>
              <input id="job-url" type="url" value={form.applicationUrl} onChange={(event) => updateField('applicationUrl', event.target.value)} disabled={isSubmitting} placeholder="https://partner.example/jobs/123" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-300/45 focus:ring-2 focus:ring-violet-400/15" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-white/65">Required skills</Label>
              <div className="mt-2"><SkillsCombobox value={form.requiredSkills} onChange={(skills) => updateField('requiredSkills', skills)} disabled={isSubmitting} /></div>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="job-description" className="text-xs text-white/65">Description</Label>
              <textarea id="job-description" value={form.description} onChange={(event) => updateField('description', event.target.value)} disabled={isSubmitting} rows={6} placeholder="Role summary, responsibilities, and candidate expectations…" className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-violet-300/45 focus:ring-2 focus:ring-violet-400/15" />
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-amber-500 px-5 text-sm font-black text-white shadow-[0_12px_32px_rgba(139,92,246,0.22)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
            {isSubmitting ? 'Publishing…' : 'Publish MSOT Job'}
          </button>
        </form>

        <div className="min-w-0 rounded-[1.75rem] border border-white/10 bg-[#111522]/80 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.26)] backdrop-blur-xl sm:p-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-violet-300">Applicant activity</p>
              <h2 className="mt-1 text-xl font-bold text-white">Active official posts</h2>
            </div>
            <Users className="h-5 w-5 text-amber-200" aria-hidden="true" />
          </div>

          {loadError && (
            <div className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-400/[0.08] p-5 text-sm text-rose-100" role="alert">{loadError}</div>
          )}
          {jobs.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center">
              <BriefcaseBusiness className="mx-auto h-7 w-7 text-white/25" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-white">No active MSOT jobs</p>
              <p className="mt-1 text-xs text-white/35">Publish the first official opportunity using the form.</p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[650px] border-separate border-spacing-y-2 text-left">
                <thead>
                  <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">
                    <th className="px-3 pb-2 font-medium">Role</th>
                    <th className="px-3 pb-2 font-medium">Details</th>
                    <th className="px-3 pb-2 font-medium">Applicants</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="align-top">
                      <td className="rounded-l-2xl border-y border-l border-white/[0.07] bg-white/[0.025] px-3 py-4">
                        <div className="flex gap-2.5">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-200"><Building2 className="h-4 w-4" aria-hidden="true" /></span>
                          <div className="min-w-0">
                            <p className="font-semibold text-white">{job.title}</p>
                            <p className="mt-1 text-xs text-white/40">{job.company}</p>
                            <Link href={job.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-200 hover:text-amber-100">Open posting <ArrowUpRight className="h-3 w-3" /></Link>
                          </div>
                        </div>
                      </td>
                      <td className="border-y border-white/[0.07] bg-white/[0.025] px-3 py-4 text-xs text-white/45">
                        <p className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{job.location || 'Unspecified'}</p>
                        <p className="mt-2 inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(job.posted_at)}</p>
                        <p className="mt-2 text-violet-200">{EMPLOYMENT_LABELS[job.employment_type]}</p>
                      </td>
                      <td className="rounded-r-2xl border-y border-r border-white/[0.07] bg-white/[0.025] px-3 py-4">
                        {job.applicants.length > 0 ? (
                          <ul className="max-h-40 space-y-2 overflow-y-auto pr-1" aria-label={`Applicants for ${job.title}`}>
                            {job.applicants.map((applicant) => (
                              <li key={applicant.userId} className="flex items-center gap-2.5">
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-amber-400 text-[9px] font-black text-white">{initials(applicant.displayName)}</span>
                                <span className="min-w-0">
                                  <span className="block truncate text-xs font-semibold text-white">{applicant.displayName}</span>
                                  <span className="block truncate text-[10px] text-white/35">{applicant.email || formatDate(applicant.appliedAt)}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : <span className="text-xs text-white/30">No applicants yet</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
