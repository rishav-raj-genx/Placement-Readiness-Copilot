'use client';

import { create } from 'zustand';
import type {
  LiveKitResultsPayload,
  LiveKitTranscriptEntry,
  LiveKitQuestionPayload,
} from '@/types';
import { loadFromStorage, saveToStorage } from '@/lib/storage';

export type LiveKitInterviewStatus =
  | 'idle'
  | 'requesting'
  | 'connecting'
  | 'active'
  | 'completed'
  | 'abandoned'
  | 'error';

export interface LiveKitInterviewRecord {
  interviewId: string;
  roomName: string;
  targetRole: string;
  durationMinutes: number;
  serverUrl: string;
  token: string;
  status: LiveKitInterviewStatus;
  currentQuestion: LiveKitQuestionPayload | null;
  transcripts: LiveKitTranscriptEntry[];
  results: LiveKitResultsPayload | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface LiveKitInterviewState {
  currentInterview: LiveKitInterviewRecord | null;
  isHydrated: boolean;
  isCreating: boolean;
  createError: string | null;

  startInterview: (
    interviewId: string,
    roomName: string,
    targetRole: string,
    serverUrl: string,
    token: string,
    durationMinutes: number
  ) => void;
  setCreating: (creating: boolean) => void;
  setCreateError: (error: string | null) => void;
  updateCurrentQuestion: (question: LiveKitQuestionPayload | null) => void;
  addTranscript: (entry: LiveKitTranscriptEntry) => void;
  setResults: (results: LiveKitResultsPayload) => void;
  setStatus: (status: LiveKitInterviewStatus) => void;
  completeInterview: () => void;
  abandonInterview: () => void;
  reset: () => void;
  hydrate: () => void;
}

function loadStored(): LiveKitInterviewRecord | null {
  return loadFromStorage<LiveKitInterviewRecord | null>('livekit-current-interview', null);
}

export const useLiveKitInterviewStore = create<LiveKitInterviewState>((set, get) => ({
  currentInterview: null,
  isHydrated: false,
  isCreating: false,
  createError: null,

  hydrate: () => {
    const stored = loadStored();
    if (stored && stored.status === 'active') {
      // If the page reloads during an active interview, mark as error so the user can restart
      set({
        currentInterview: { ...stored, status: 'error' },
        isHydrated: true,
      });
    } else {
      set({ currentInterview: stored, isHydrated: true });
    }
  },

  setCreating: (creating: boolean) => set({ isCreating: creating }),
  setCreateError: (error: string | null) => set({ createError: error }),

  startInterview: (
    interviewId: string,
    roomName: string,
    targetRole: string,
    serverUrl: string,
    token: string,
    durationMinutes: number
  ) => {
    const record: LiveKitInterviewRecord = {
      interviewId,
      roomName,
      targetRole,
      durationMinutes,
      serverUrl,
      token,
      status: 'connecting',
      currentQuestion: null,
      transcripts: [],
      results: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    saveToStorage('livekit-current-interview', record);
    set({ currentInterview: record, createError: null });
  },

  updateCurrentQuestion: (question: LiveKitQuestionPayload | null) => {
    const current = get().currentInterview;
    if (!current) return;
    const updated = { ...current, currentQuestion: question, status: 'active' as const };
    saveToStorage('livekit-current-interview', updated);
    set({ currentInterview: updated });
  },

  addTranscript: (entry: LiveKitTranscriptEntry) => {
    const current = get().currentInterview;
    if (!current) return;
    const existingIndex = current.transcripts.findIndex((item) => item.id === entry.id);
    const transcripts = [...current.transcripts];
    if (existingIndex === -1) {
      transcripts.push(entry);
    } else {
      transcripts[existingIndex] = entry;
    }
    const updated = {
      ...current,
      transcripts,
    };
    saveToStorage('livekit-current-interview', updated);
    set({ currentInterview: updated });
  },

  setResults: (results: LiveKitResultsPayload) => {
    const current = get().currentInterview;
    if (!current) return;
    const updated = {
      ...current,
      results,
      status: 'completed' as const,
      completedAt: new Date().toISOString(),
    };
    saveToStorage('livekit-current-interview', updated);
    set({ currentInterview: updated });
  },

  setStatus: (status: LiveKitInterviewStatus) => {
    const current = get().currentInterview;
    if (!current) return;
    const updated = { ...current, status };
    saveToStorage('livekit-current-interview', updated);
    set({ currentInterview: updated });
  },

  completeInterview: () => {
    const current = get().currentInterview;
    if (!current) return;
    const updated = {
      ...current,
      status: 'completed' as const,
      completedAt: new Date().toISOString(),
    };
    saveToStorage('livekit-current-interview', updated);
    set({ currentInterview: updated });
  },

  abandonInterview: () => {
    const current = get().currentInterview;
    if (!current) return;
    const updated = { ...current, status: 'abandoned' as const };
    saveToStorage('livekit-current-interview', updated);
    set({ currentInterview: updated });
  },

  reset: () => {
    saveToStorage('livekit-current-interview', null);
    set({ currentInterview: null, createError: null, isCreating: false });
  },
}));
