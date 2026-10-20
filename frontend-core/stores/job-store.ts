'use client';

import { create } from 'zustand';
import type { JobPosting } from '@/types';
import { loadFromStorage, saveToStorage } from '@/lib/storage';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import { normalizeDiscoveredJobs } from '@/lib/data-adapters';
import { inferEmploymentType, matchesJobProfile, type JobMatchProfile } from '@/lib/job-matching';

type NewJobPosting = Omit<JobPosting, 'id' | 'createdAt' | 'updatedAt'>;

interface JobState {
  jobs: JobPosting[];
  matchedJobs: JobPosting[];
  isHydrated: boolean;
  error: string | null;
  hydrate: (profile?: JobMatchProfile) => Promise<void>;
  addJob: (job: NewJobPosting) => Promise<void>;
  updateJob: (id: string, updates: Partial<JobPosting>) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  togglePublish: (id: string) => Promise<void>;
  getPublishedJobs: () => JobPosting[];
}

function toDatabasePayload(job: NewJobPosting | JobPosting | Partial<JobPosting>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (job.title !== undefined) payload.title = job.title;
  if (job.company !== undefined) payload.company = job.company;
  if (job.location !== undefined) payload.location = job.location;
  if (job.employmentType !== undefined) {
    payload.employment_type = job.employmentType;
    payload.job_type = job.employmentType;
  }
  if (job.description !== undefined) payload.description = job.description;
  if (job.requiredSkills !== undefined) payload.required_skills = job.requiredSkills;
  if (job.applicationUrl !== undefined) payload.url = job.applicationUrl;
  if (job.status !== undefined) payload.publication_status = job.status;
  return payload;
}

function persistLocal(jobs: JobPosting[]): void {
  saveToStorage('jobs', jobs);
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  matchedJobs: [],
  isHydrated: false,
  error: null,

  hydrate: async (profile) => {
    if (!isSupabaseConfigured) {
      const jobs = loadFromStorage<JobPosting[]>('jobs', [])
        .filter((job) => !profile || job.status === 'published');
      set({
        jobs,
        matchedJobs: profile ? jobs.filter((job) => matchesJobProfile(job, profile)) : [],
        isHydrated: true,
        error: null,
      });
      return;
    }

    try {
      let query = supabase
        .from('discovered_jobs')
        .select('*');
      if (profile) query = query.eq('publication_status', 'published');
      const { data, error } = await query
        .order('relevance_score', { ascending: false })
        .order('posted_at', { ascending: false });
      if (error) throw error;
      const jobs = normalizeDiscoveredJobs(data as unknown);

      let matchCandidates = jobs;
      if (profile) {
        const employmentType = inferEmploymentType(profile.targetRole);
        const skills = Array.from(new Set(profile.skills.map((skill) => skill.trim()).filter(Boolean))).slice(0, 12);
        const filters = skills.length ? skills : [null];
        const matchResponses = await Promise.all(filters.map(async (skill) => {
          let matchQuery = supabase
            .from('discovered_jobs')
            .select('*')
            .eq('publication_status', 'published');
          if (skill) matchQuery = matchQuery.contains('required_skills', [skill]);
          if (employmentType) matchQuery = matchQuery.eq('employment_type', employmentType);
          return matchQuery.order('relevance_score', { ascending: false });
        }));
        const matchedById = new Map<string, JobPosting>();
        for (const response of matchResponses) {
          if (response.error) throw response.error;
          for (const job of normalizeDiscoveredJobs(response.data as unknown)) matchedById.set(job.id, job);
        }
        if (matchedById.size > 0) matchCandidates = Array.from(matchedById.values());
      }

      set({
        jobs,
        matchedJobs: profile ? matchCandidates.filter((job) => matchesJobProfile(job, profile)) : [],
        isHydrated: true,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load jobs from Supabase.';
      const jobs = loadFromStorage<JobPosting[]>('jobs', [])
        .filter((job) => !profile || job.status === 'published');
      set({
        jobs,
        matchedJobs: profile ? jobs.filter((job) => matchesJobProfile(job, profile)) : [],
        isHydrated: true,
        error: message,
      });
    }
  },

  addJob: async (job) => {
    const now = new Date().toISOString();
    const newJob: JobPosting = {
      ...job,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      source: 'MSOT Admin',
    };

    if (isSupabaseConfigured) {
      const payload = {
        id: newJob.id,
        ...toDatabasePayload(newJob),
        source: 'MSOT Admin',
        posted_at: now,
        created_at: now,
        updated_at: now,
      };
      const { data, error } = await supabase.from('discovered_jobs').insert(payload).select('*').single();
      if (error) throw error;
      const [savedJob] = normalizeDiscoveredJobs([data] as unknown);
      if (!savedJob) throw new Error('Supabase returned an invalid job posting.');
      set({ jobs: [savedJob, ...get().jobs], error: null });
      return;
    }

    const jobs = [newJob, ...get().jobs];
    persistLocal(jobs);
    set({ jobs, error: null });
  },

  updateJob: async (id, updates) => {
    const updatedAt = new Date().toISOString();
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('discovered_jobs')
        .update({ ...toDatabasePayload(updates), updated_at: updatedAt })
        .eq('id', id);
      if (error) throw error;
    }

    const jobs = get().jobs.map((job) =>
      job.id === id ? { ...job, ...updates, updatedAt } : job
    );
    if (!isSupabaseConfigured) persistLocal(jobs);
    set({ jobs, error: null });
  },

  deleteJob: async (id) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('discovered_jobs').delete().eq('id', id);
      if (error) throw error;
    }

    const jobs = get().jobs.filter((job) => job.id !== id);
    if (!isSupabaseConfigured) persistLocal(jobs);
    set({ jobs, error: null });
  },

  togglePublish: async (id) => {
    const job = get().jobs.find((candidate) => candidate.id === id);
    if (!job) throw new Error('Job posting not found.');
    await get().updateJob(id, {
      status: job.status === 'published' ? 'unpublished' : 'published',
    });
  },

  getPublishedJobs: () => get().jobs.filter((job) => job.status === 'published'),
}));
