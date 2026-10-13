'use client';

import { create } from 'zustand';
import type { JobApplication, ApplicationStatus } from '@/types';
import { loadFromStorage, saveToStorage } from '@/lib/storage';
import { fixtureApplications } from '@/lib/fixtures/applications';

interface ApplicationState {
  applications: JobApplication[];
  isHydrated: boolean;

  hydrate: () => void;
  addApplication: (app: Omit<JobApplication, 'id' | 'createdAt'>) => void;
  updateApplication: (id: string, updates: Partial<JobApplication>) => void;
  deleteApplication: (id: string) => void;
  moveApplication: (id: string, status: ApplicationStatus) => void;
}

export const useApplicationStore = create<ApplicationState>((set, get) => ({
  applications: [],
  isHydrated: false,

  hydrate: () => {
    const applications = loadFromStorage<JobApplication[]>('applications', fixtureApplications);
    set({ applications, isHydrated: true });
  },

  addApplication: (app) => {
    const newApp: JobApplication = {
      ...app,
      id: 'app-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    const applications = [...get().applications, newApp];
    saveToStorage('applications', applications);
    set({ applications });
  },

  updateApplication: (id: string, updates: Partial<JobApplication>) => {
    const applications = get().applications.map((a) =>
      a.id === id ? { ...a, ...updates } : a
    );
    saveToStorage('applications', applications);
    set({ applications });
  },

  deleteApplication: (id: string) => {
    const applications = get().applications.filter((a) => a.id !== id);
    saveToStorage('applications', applications);
    set({ applications });
  },

  moveApplication: (id: string, status: ApplicationStatus) => {
    const applications = get().applications.map((a) =>
      a.id === id ? { ...a, status } : a
    );
    saveToStorage('applications', applications);
    set({ applications });
  },
}));
