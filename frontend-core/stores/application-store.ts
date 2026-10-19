'use client';

import { create } from 'zustand';
import type { ApplicationStatus, JobApplication } from '@/types';
import { loadFromStorage, saveToStorage } from '@/lib/storage';
import { normalizeApplications } from '@/lib/data-adapters';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import { findMatchingApplication } from '@/lib/applications';

type NewApplication = Omit<JobApplication, 'id' | 'createdAt'>;

interface ApplicationState {
  applications: JobApplication[];
  isHydrated: boolean;
  error: string | null;
  hydrate: (userId?: string) => Promise<void>;
  addApplication: (application: NewApplication) => Promise<void>;
  updateApplication: (id: string, updates: Partial<JobApplication>) => Promise<void>;
  deleteApplication: (id: string) => Promise<void>;
  moveApplication: (id: string, status: ApplicationStatus) => Promise<void>;
}

function persistLocal(applications: JobApplication[]): void {
  saveToStorage('applications', applications);
}

function statusAppliedAt(status: ApplicationStatus, date: string): string | null {
  return status === 'saved' ? null : `${date}T00:00:00.000Z`;
}

export const useApplicationStore = create<ApplicationState>((set, get) => ({
  applications: [],
  isHydrated: false,
  error: null,

  hydrate: async (userId) => {
    if (!isSupabaseConfigured || !userId) {
      const applications = loadFromStorage<JobApplication[]>('applications', [])
        .filter((application) => !userId || application.userId === userId);
      set({ applications, isHydrated: true, error: null });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('application_tracker')
        .select('*')
        .eq('student_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      set({ applications: normalizeApplications(data as unknown), isHydrated: true, error: null });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Unable to load applications from Supabase.';
      set({
        applications: loadFromStorage<JobApplication[]>('applications', [])
          .filter((application) => application.userId === userId),
        isHydrated: true,
        error: message,
      });
    }
  },

  addApplication: async (application) => {
    const existing = findMatchingApplication(get().applications, application);
    if (existing) {
      await get().updateApplication(existing.id, application);
      return;
    }
    const createdAt = new Date().toISOString();
    const newApplication: JobApplication = {
      ...application,
      id: crypto.randomUUID(),
      createdAt,
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('application_tracker')
        .insert({
          id: newApplication.id,
          student_id: newApplication.userId,
          job_id: newApplication.jobId || null,
          company: newApplication.company,
          role: newApplication.jobTitle,
          url: newApplication.jobPostingUrl || null,
          status: newApplication.status,
          applied_at: statusAppliedAt(newApplication.status, newApplication.applicationDate),
          notes: newApplication.notes || null,
          created_at: createdAt,
          updated_at: createdAt,
        })
        .select('*')
        .single();
      if (error) throw error;
      const [savedApplication] = normalizeApplications([data] as unknown);
      if (!savedApplication) throw new Error('Supabase returned an invalid application.');
      set({ applications: [savedApplication, ...get().applications], error: null });
      return;
    }

    const applications = [newApplication, ...get().applications];
    persistLocal(applications);
    set({ applications, error: null });
  },

  updateApplication: async (id, updates) => {
    const existing = get().applications.find((application) => application.id === id);
    if (!existing) throw new Error('Application not found.');
    const next = { ...existing, ...updates };

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('application_tracker')
        .update({
          job_id: next.jobId || null,
          company: next.company,
          role: next.jobTitle,
          url: next.jobPostingUrl || null,
          status: next.status,
          applied_at: statusAppliedAt(next.status, next.applicationDate),
          notes: next.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    }

    const applications = get().applications.map((application) =>
      application.id === id ? next : application
    );
    if (!isSupabaseConfigured) persistLocal(applications);
    set({ applications, error: null });
  },

  deleteApplication: async (id) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('application_tracker').delete().eq('id', id);
      if (error) throw error;
    }

    const applications = get().applications.filter((application) => application.id !== id);
    if (!isSupabaseConfigured) persistLocal(applications);
    set({ applications, error: null });
  },

  moveApplication: async (id, status) => {
    await get().updateApplication(id, { status });
  },
}));
