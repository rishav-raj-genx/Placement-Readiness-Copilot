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
  topics?: string[];
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
  mode?: 'voice' | 'text';
  provider?: 'cloud_api' | 'ollama_local';
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
    durationMinutes: number,
    topics?: string[],
    mode?: 'voice' | 'text',
    provider?: 'cloud_api' | 'ollama_local'
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

function persistState(record: LiveKitInterviewRecord | null) {
  if (!record || record.status === 'abandoned') {
    saveToStorage('livekit-current-interview', null);
    return;
  }
  // Never persist LiveKit access tokens in localStorage; minimize transcript retention
  const { token: _token, ...safeRecord } = record;
  saveToStorage('livekit-current-interview', {
    ...safeRecord,
    token: '', // Keep token strictly in memory
    transcripts: record.transcripts.slice(-30),
  });
}

function loadStored(): LiveKitInterviewRecord | null {
  const stored = loadFromStorage<LiveKitInterviewRecord | null>('livekit-current-interview', null);
  if (!stored) return null;
  // Ensure token is empty on hydration from storage
  return { ...stored, token: '' };
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
    durationMinutes: number,
    topics?: string[],
    mode?: 'voice' | 'text',
    provider?: 'cloud_api' | 'ollama_local'
  ) => {
    const record: LiveKitInterviewRecord = {
      interviewId,
      roomName,
      targetRole,
      topics,
      durationMinutes,
      serverUrl,
      token,
      mode: mode || 'voice',
      provider: provider || 'cloud_api',
      status: 'connecting',
      currentQuestion: null,
      transcripts: [],
      results: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    persistState(record);
    set({ currentInterview: record, createError: null });
  },

  updateCurrentQuestion: (question: LiveKitQuestionPayload | null) => {
    const current = get().currentInterview;
    if (!current) return;
    const updated = { ...current, currentQuestion: question, status: 'active' as const };
    persistState(updated);
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
    persistState(updated);
    set({ currentInterview: updated });
  },

  setResults: (results: LiveKitResultsPayload) => {
    const current = get().currentInterview;
    const fallbackRecord: LiveKitInterviewRecord = {
      interviewId: '',
      roomName: '',
      targetRole: 'Software Engineer',
      durationMinutes: 15,
      serverUrl: '',
      token: '',
      status: 'completed',
      currentQuestion: null,
      transcripts: [],
      results,
      startedAt: null,
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const updated: LiveKitInterviewRecord = {
      ...(current || fallbackRecord),
      token: '', // clear token from memory
      results,
      status: 'completed' as const,
      completedAt: new Date().toISOString(),
    };
    persistState(updated);
    if (updated.interviewId) {
      saveToStorage(`interview_result_${updated.interviewId}`, results);
    }
    set({ currentInterview: updated });
  },

  setStatus: (status: LiveKitInterviewStatus) => {
    const current = get().currentInterview;
    if (!current) return;
    const updated = { ...current, status };
    if (status === 'completed' || status === 'abandoned' || status === 'error') {
      persistState(null);
    } else {
      persistState(updated);
    }
    set({ currentInterview: updated });
  },

  completeInterview: () => {
    const current = get().currentInterview;
    if (!current) return;
    const updated = {
      ...current,
      token: '',
      status: 'completed' as const,
      completedAt: new Date().toISOString(),
    };
    persistState(null); // Clear from browser storage
    set({ currentInterview: updated });
  },

  abandonInterview: () => {
    const current = get().currentInterview;
    if (!current) return;
    const updated = { ...current, token: '', status: 'abandoned' as const };
    persistState(null); // Clear from browser storage
    set({ currentInterview: updated });
  },

  reset: () => {
    persistState(null);
    set({ currentInterview: null, createError: null, isCreating: false });
  },
}));
