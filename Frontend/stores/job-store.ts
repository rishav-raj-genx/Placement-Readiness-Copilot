'use client';

import { create } from 'zustand';
import type { JobPosting, JobStatus } from '@/types';
import { loadFromStorage, saveToStorage } from '@/lib/storage';

interface JobState {
  jobs: JobPosting[];
  isHydrated: boolean;

  hydrate: () => void;
  addJob: (job: Omit<JobPosting, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateJob: (id: string, updates: Partial<JobPosting>) => void;
  deleteJob: (id: string) => void;
  togglePublish: (id: string) => void;
  getPublishedJobs: () => JobPosting[];
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  isHydrated: false,

  hydrate: () => {
    const jobs = loadFromStorage<JobPosting[]>('jobs', []);
    set({ jobs, isHydrated: true });
  },

  addJob: (job) => {
    const now = new Date().toISOString();
    const newJob: JobPosting = {
      ...job,
      id: 'job-' + Date.now(),
      createdAt: now,
      updatedAt: now,
    };
    const jobs = [...get().jobs, newJob];
    saveToStorage('jobs', jobs);
    set({ jobs });
  },

  updateJob: (id: string, updates: Partial<JobPosting>) => {
    const jobs = get().jobs.map((j) =>
      j.id === id ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j
    );
    saveToStorage('jobs', jobs);
    set({ jobs });
  },

  deleteJob: (id: string) => {
    const jobs = get().jobs.filter((j) => j.id !== id);
    saveToStorage('jobs', jobs);
    set({ jobs });
  },

  togglePublish: (id: string) => {
    const jobs = get().jobs.map((j) =>
      j.id === id
        ? {
            ...j,
            status: (j.status === 'published' ? 'unpublished' : 'published') as JobStatus,
            updatedAt: new Date().toISOString(),
          }
        : j
    );
    saveToStorage('jobs', jobs);
    set({ jobs });
  },

  getPublishedJobs: () => get().jobs.filter((j) => j.status === 'published'),
}));
