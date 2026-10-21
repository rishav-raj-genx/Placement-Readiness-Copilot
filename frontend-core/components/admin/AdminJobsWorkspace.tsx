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
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { SkillsCombobox } from '@/components/admin/SkillsCombobox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase-client';
import { revalidateJobsCache } from '@/app/actions/revalidate-jobs';
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
  full_time: 'Full time',
  part_time: 'Part time',
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
        student_id: null,
        posted_at: now,
        updated_at: now,
      });
      if (error) throw error;

      await revalidateJobsCache().catch(() => null);
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
    <div className="space-y-6 pb-16">
      <section className="rounded-2xl border border-stone-800 bg-[#121826] p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Official opportunities</p>
            <h1 className="mt-2 font-[var(--font-display)] text-3xl font-bold tracking-tight text-stone-100 sm:text-4xl">MSOT job board</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-400">Publish verified partner roles directly to eligible candidates.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-stone-800 bg-stone-900/60 px-4 py-3">
              <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Active posts</p>
              <p className="mt-1 text-2xl font-bold text-stone-100">{jobs.length}</p>
            </div>
            <div className="rounded-xl border border-stone-800 bg-stone-900/60 px-4 py-3">
              <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Applicants</p>
              <p className="mt-1 text-2xl font-bold text-stone-100">{totalApplicants}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={(event) => void handleSubmit(event)} className="rounded-2xl border border-stone-800 bg-[#121826] p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-orange-500/20 bg-orange-500/10 text-orange-400">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-stone-100">Post an official role</h2>
              <p className="mt-0.5 text-xs text-stone-400">Published immediately with MSOT priority.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="job-title" className="text-xs font-medium text-stone-300">Job title</Label>
              <input
                id="job-title"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                disabled={isSubmitting}
                placeholder="Graduate Software Engineer"
                className="mt-1.5 h-11 w-full rounded-lg border border-stone-800 bg-stone-900/80 px-3.5 text-sm text-stone-200 outline-none placeholder:text-stone-500 focus:border-[#D93829] focus:ring-1 focus:ring-[#D93829]"
              />
            </div>
            <div>
              <Label htmlFor="job-company" className="text-xs font-medium text-stone-300">Company</Label>
              <input
                id="job-company"
                value={form.company}
                onChange={(event) => updateField('company', event.target.value)}
                disabled={isSubmitting}
                className="mt-1.5 h-11 w-full rounded-lg border border-stone-800 bg-stone-900/80 px-3.5 text-sm text-stone-200 outline-none focus:border-[#D93829] focus:ring-1 focus:ring-[#D93829]"
              />
            </div>
            <div>
              <Label htmlFor="job-location" className="text-xs font-medium text-stone-300">Location</Label>
              <input
                id="job-location"
                value={form.location}
                onChange={(event) => updateField('location', event.target.value)}
                disabled={isSubmitting}
                placeholder="Remote · India"
                className="mt-1.5 h-11 w-full rounded-lg border border-stone-800 bg-stone-900/80 px-3.5 text-sm text-stone-200 outline-none placeholder:text-stone-500 focus:border-[#D93829] focus:ring-1 focus:ring-[#D93829]"
              />
            </div>
            <div>
              <Label htmlFor="job-employment" className="text-xs font-medium text-stone-300">Employment type</Label>
              <select
                id="job-employment"
                value={form.employmentType}
                onChange={(event) => updateField('employmentType', event.target.value as DiscoveredJob['employment_type'])}
                disabled={isSubmitting}
                className="mt-1.5 h-11 w-full rounded-lg border border-stone-800 bg-stone-900 px-3.5 text-sm text-stone-200 outline-none focus:border-[#D93829] focus:ring-1 focus:ring-[#D93829]"
              >
                {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="job-url" className="text-xs font-medium text-stone-300">Application URL</Label>
              <input
                id="job-url"
                type="url"
                value={form.applicationUrl}
                onChange={(event) => updateField('applicationUrl', event.target.value)}
                disabled={isSubmitting}
                placeholder="https://partner.example/jobs/123"
                className="mt-1.5 h-11 w-full rounded-lg border border-stone-800 bg-stone-900/80 px-3.5 text-sm text-stone-200 outline-none placeholder:text-stone-500 focus:border-[#D93829] focus:ring-1 focus:ring-[#D93829]"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs font-medium text-stone-300">Required skills</Label>
              <div className="mt-1.5">
                <SkillsCombobox value={form.requiredSkills} onChange={(skills) => updateField('requiredSkills', skills)} disabled={isSubmitting} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="job-description" className="text-xs font-medium text-stone-300">Description</Label>
              <textarea
                id="job-description"
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                disabled={isSubmitting}
                rows={5}
                placeholder="Role summary, responsibilities, and candidate expectations…"
                className="mt-1.5 w-full resize-y rounded-lg border border-stone-800 bg-stone-900/80 px-3.5 py-2.5 text-sm leading-relaxed text-stone-200 outline-none placeholder:text-stone-500 focus:border-[#D93829] focus:ring-1 focus:ring-[#D93829]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
            {isSubmitting ? 'Publishing…' : 'Publish MSOT job'}
          </button>
        </form>

        <div className="min-w-0 rounded-2xl border border-stone-800 bg-[#121826] p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-orange-400">Applicant activity</p>
              <h2 className="mt-1 text-lg font-bold text-stone-100">Active official posts</h2>
            </div>
            <Users className="h-5 w-5 text-stone-400" aria-hidden="true" />
          </div>

          {loadError && (
            <div className="mt-5 rounded-xl border border-red-900/50 bg-red-950/40 p-4 text-sm text-red-300" role="alert">{loadError}</div>
          )}
          {jobs.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-stone-800 px-5 py-12 text-center">
              <BriefcaseBusiness className="mx-auto h-7 w-7 text-stone-500" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-stone-200">No active MSOT jobs</p>
              <p className="mt-1 text-xs text-stone-400">Publish the first official opportunity using the form.</p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-stone-800 font-mono text-xs uppercase tracking-wider text-stone-400">
                    <th className="px-3 pb-3 font-medium">Role</th>
                    <th className="px-3 pb-3 font-medium">Details</th>
                    <th className="px-3 pb-3 font-medium text-right">Applicants</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b border-stone-800/80 align-top transition-colors hover:bg-stone-900/40">
                      <td className="px-3 py-4">
                        <div className="flex gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-stone-700 bg-stone-800 text-stone-300">
                            <Building2 className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-stone-100">{job.title}</p>
                            <p className="mt-0.5 text-xs text-stone-400">{job.company}</p>
                            <Link href={job.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#D93829] hover:underline">
                              Open posting <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-xs text-stone-400">
                        <p className="inline-flex items-center gap-1.5 text-stone-300"><MapPin className="h-3.5 w-3.5 text-stone-500" />{job.location || 'Unspecified'}</p>
                        <p className="mt-1 inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-stone-500" />{formatDate(job.posted_at)}</p>
                        <p className="mt-1.5 inline-block rounded border border-stone-700 bg-stone-800 px-1.5 py-0.5 text-stone-300">{EMPLOYMENT_LABELS[job.employment_type]}</p>
                      </td>
                      <td className="px-3 py-4 text-right">
                        {job.applicants.length > 0 ? (
                          <div className="inline-block text-left">
                            <div className="mb-1 text-right font-mono text-xs font-semibold text-stone-200">
                              {job.applicants.length}
                            </div>
                            <ul className="max-h-36 space-y-2 overflow-y-auto pr-1" aria-label={`Applicants for ${job.title}`}>
                              {job.applicants.map((applicant) => (
                                <li key={applicant.userId} className="flex items-center gap-2">
                                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-stone-700 bg-stone-800 font-mono text-xs font-semibold text-stone-200">
                                    {initials(applicant.displayName)}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-xs font-medium text-stone-200">{applicant.displayName}</span>
                                    <span className="block truncate text-xs text-stone-400">{applicant.email || formatDate(applicant.appliedAt)}</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-500">0</span>
                        )}
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
