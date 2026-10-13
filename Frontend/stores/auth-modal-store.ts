'use client';

import { create } from 'zustand';

interface AuthModalState {
  isOpen: boolean;
  redirectUrl: string;
  open: (redirectUrl?: string) => void;
  close: () => void;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  isOpen: false,
  redirectUrl: '/dashboard',
  open: (redirectUrl = '/dashboard') => set({ isOpen: true, redirectUrl }),
  close: () => set({ isOpen: false }),
}));
