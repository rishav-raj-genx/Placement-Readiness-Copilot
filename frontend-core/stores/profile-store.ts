'use client';

import { create } from 'zustand';
import {
  normalizeProfileReviewRecord,
  normalizeUserProfile,
  PROFILE_SELECT_COLUMNS,
} from '@/lib/profile-adapters';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import type { CandidateProfileReviewRecord, UserProfile } from '@/types';
import type { ReadinessScore } from '@/types';
import { normalizeReadinessScore } from '@/lib/data-adapters';

interface ProfileState {
  profile: UserProfile | null;
  review: CandidateProfileReviewRecord | null;
  readiness: ReadinessScore | null;
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  hydrate: (userId: string) => Promise<void>;
  analyze: (userId: string) => Promise<boolean>;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  review: null,
  readiness: null,
  isLoading: false,
  isAnalyzing: false,
  error: null,

  hydrate: async (userId) => {
    if (!isSupabaseConfigured) {
      set({ isLoading: false, error: 'Supabase is not configured.' });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const [profileResponse, reviewResponse, readinessResponse, sessionCountResponse] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('candidate_profile_reviews').select('*').eq('student_id', userId).maybeSingle(),
        supabase.from('readiness_scores').select('*').eq('student_id', userId).maybeSingle(),
        supabase.from('interview_sessions').select('id', { count: 'exact', head: true }).or(`user_id.eq.${userId},student_id.eq.${userId}`),
      ]);
      if (profileResponse.error) throw profileResponse.error;
      if (reviewResponse.error && reviewResponse.error.code !== 'PGRST116') throw reviewResponse.error;
      if (readinessResponse.error && readinessResponse.error.code !== 'PGRST116') throw readinessResponse.error;
      const profile = normalizeUserProfile(profileResponse.data as unknown);
      if (!profile) throw new Error('The candidate profile response was invalid.');
      const sessionCount = typeof sessionCountResponse?.count === 'number' ? sessionCountResponse.count : 0;
      const rawCredits = typeof profile.interviewCredits === 'number' ? profile.interviewCredits : 3;
      const effectiveCredits = Math.max(0, Math.min(rawCredits, 3 - sessionCount));
      profile.interviewCredits = effectiveCredits;
      profile.interviewCount = sessionCount;
      set({
        profile,
        review: normalizeProfileReviewRecord(reviewResponse.data as unknown),
        readiness: normalizeReadinessScore(readinessResponse.data as unknown),
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unable to load the candidate profile.',
      });
    }
  },

  analyze: async (userId) => {
    if (get().isAnalyzing) return false;
    set({ isAnalyzing: true, error: null });
    try {
      const internalKey = process.env.NEXT_PUBLIC_INTERNAL_SERVICE_KEY || process.env.INTERNAL_SERVICE_KEY || '';
      const response = await fetch('/api/profile-review/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...(internalKey ? { Authorization: `Bearer ${internalKey}` } : {}),
        },
        cache: 'no-store',
        body: JSON.stringify({
          userId,
          forceRefresh: true,
          requestedAt: new Date().toISOString(),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof payload === 'object' && payload !== null && 'error' in payload
          ? String(payload.error)
          : 'Profile analysis failed.';
        throw new Error(message);
      }
      await get().hydrate(userId);
      return get().error === null;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Profile analysis failed.' });
      return false;
    } finally {
      set({ isAnalyzing: false });
    }
  },

  reset: () => set({ profile: null, review: null, readiness: null, isLoading: false, isAnalyzing: false, error: null }),
}));
