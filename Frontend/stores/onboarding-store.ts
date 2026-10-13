'use client';

import { create } from 'zustand';
import { loadFromStorage, saveToStorage, removeFromStorage } from '@/lib/storage';

const ANON_KEY = 'onboarding-anon';

type OnboardingStatus = 'incomplete' | 'completed' | 'dismissed';

interface OnboardingState {
  isOpen: boolean;
  isManualOpen: boolean;
  hasChecked: boolean;
  open: () => void;
  openManual: () => void;
  close: () => void;
  complete: (userId?: string) => void;
  dismiss: (userId?: string) => void;
  shouldAutoOpen: (userId?: string | null) => boolean;
  checkAndAutoOpen: (userId?: string | null) => void;
}

function getUserKey(userId?: string | null): string {
  if (!userId) return ANON_KEY;
  return `onboarding-user-${userId}`;
}

function getStatus(userId?: string | null): OnboardingStatus {
  return loadFromStorage<OnboardingStatus>(getUserKey(userId), 'incomplete');
}

function setStatus(userId: string | null, status: OnboardingStatus): void {
  saveToStorage(getUserKey(userId), status);
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  isOpen: false,
  isManualOpen: false,
  hasChecked: false,

  open: () => set({ isOpen: true, isManualOpen: false }),
  openManual: () => set({ isOpen: true, isManualOpen: true }),
  close: () => set({ isOpen: false, isManualOpen: false }),

  complete: (userId) => {
    setStatus(userId ?? null, 'completed');
    set({ isOpen: false, isManualOpen: false, hasChecked: true });
  },

  dismiss: (userId) => {
    setStatus(userId ?? null, 'dismissed');
    set({ isOpen: false, isManualOpen: false, hasChecked: true });
  },

  shouldAutoOpen: (userId) => {
    const status = getStatus(userId ?? null);
    return status === 'incomplete';
  },

  checkAndAutoOpen: (userId) => {
    if (get().hasChecked) return;
    const status = getStatus(userId ?? null);
    set({ hasChecked: true });
    if (status === 'incomplete') {
      set({ isOpen: true, isManualOpen: false });
    }
  },
}));
