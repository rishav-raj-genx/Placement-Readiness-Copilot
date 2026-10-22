'use client';

import { create } from 'zustand';
import type { UserProfile } from '@/types';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import {
  normalizeUserProfile,
  PROFILE_SELECT_COLUMNS,
  PROFILE_SAFE_FALLBACK_COLUMNS,
} from '@/lib/profile-adapters';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';

export type SignUpResult = 'authenticated' | 'confirmation_required' | 'failed';

interface AuthState {
  user: UserProfile | null;
  isPreview: boolean;
  isGuest: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  hydrate: () => void;
  clearError: () => void;
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    const errorMsg = error.message || '';
    const isColumnMissing =
      error.code === '42703' ||
      error.code === 'PGRST204' ||
      errorMsg.includes('does not exist') ||
      errorMsg.includes('linkedin_text');

    if (isColumnMissing) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('profiles')
        .select(PROFILE_SAFE_FALLBACK_COLUMNS)
        .eq('id', userId)
        .maybeSingle();

      if (!fallbackError && fallbackData) {
        return normalizeUserProfile(fallbackData as unknown);
      }
    }
    throw error;
  }

  return normalizeUserProfile(data as unknown);
}

async function resolveOrCreateProfile(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  created_at?: string;
}): Promise<UserProfile> {
  let profile: UserProfile | null = null;
  try {
    profile = await fetchProfile(authUser.id);
  } catch {
    profile = null;
  }

  if (profile) return profile;

  const fallbackDisplayName =
    (authUser.user_metadata?.display_name as string | undefined) ||
    (authUser.user_metadata?.full_name as string | undefined) ||
    (authUser.user_metadata?.name as string | undefined) ||
    authUser.email?.split('@')[0] ||
    'Candidate';
  const fallbackEmail = authUser.email ?? 'candidate@prepcopilot.local';

  try {
    await supabase.from('profiles').upsert(
      {
        id: authUser.id,
        email: fallbackEmail,
        display_name: fallbackDisplayName,
        role: 'student',
        created_at: authUser.created_at ?? new Date().toISOString(),
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
    profile = await fetchProfile(authUser.id);
  } catch {
    // non-blocking
  }

  return (
    profile ?? {
      id: authUser.id,
      email: fallbackEmail,
      displayName: fallbackDisplayName,
      role: 'student',
      createdAt: authUser.created_at ?? new Date().toISOString(),
      targetLocations: [],
      skills: [],
      projects: [],
      interviewCredits: 3,
      isPremium: false,
      onboardingCompletedAt: new Date().toISOString(),
    }
  );
}

let authListenerRegistered = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isPreview: true,
  isGuest: true,
  isHydrated: false,
  isLoading: false,
  error: null,

  signIn: async (email: string, password: string) => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      if (!isSupabaseConfigured) {
        throw new Error(
          'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.'
        );
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      let profile = await resolveOrCreateProfile(data.user);

      if (!profile.onboardingCompletedAt) {
        const now = new Date().toISOString();
        try {
          await supabase.from('profiles').update({ onboarding_completed_at: now }).eq('id', data.user.id);
        } catch {
          // non-blocking
        }
        profile = { ...profile, onboardingCompletedAt: now };
      }

      set({ user: profile, isPreview: false, isGuest: false, isLoading: false });
    } catch (error: unknown) {
      const message = getAuthErrorMessage(error, 'sign_in');
      set({ isLoading: false, error: message });
    }
  },

  signUp: async (email: string, password: string, displayName: string) => {
    if (get().isLoading) return 'failed';
    set({ isLoading: true, error: null });
    try {
      if (!isSupabaseConfigured) {
        throw new Error(
          'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.'
        );
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: typeof window === 'undefined'
            ? undefined
            : `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error('Sign up failed — no user returned');

      if (!data.session) {
        set({ user: null, isPreview: true, isGuest: true, isLoading: false });
        return 'confirmation_required';
      }

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        display_name: displayName,
        role: 'student',
      }, {
        onConflict: 'id',
        ignoreDuplicates: true,
      });

      if (profileError) throw profileError;

      let profile = await fetchProfile(data.user.id);
      if (!profile) throw new Error('Failed to load profile after signup');

      if (!profile.onboardingCompletedAt) {
        const now = new Date().toISOString();
        try {
          await supabase.from('profiles').update({ onboarding_completed_at: now }).eq('id', data.user.id);
        } catch {
          // non-blocking
        }
        profile = { ...profile, onboardingCompletedAt: now };
      }

      set({ user: profile, isPreview: false, isGuest: false, isLoading: false });
      return 'authenticated';
    } catch (error: unknown) {
      const message = getAuthErrorMessage(error, 'sign_up');
      set({ isLoading: false, error: message });
      return 'failed';
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      set({ user: null, isPreview: true, isGuest: true, error: error ? getAuthErrorMessage(error, 'sign_out') : null });
    } catch (error: unknown) {
      const message = getAuthErrorMessage(error, 'sign_out');
      set({ user: null, isPreview: true, isGuest: true, error: message });
    }
  },

  hydrate: () => {
    if (!isSupabaseConfigured) {
      set({ isHydrated: true, isPreview: true, isGuest: true });
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        set({ user: null, isPreview: true, isGuest: true, isHydrated: true });
        return;
      }
      try {
        const profile = await resolveOrCreateProfile(session.user);
        set({ user: profile, isPreview: false, isGuest: false, isHydrated: true });
      } catch (error: unknown) {
        const message = getAuthErrorMessage(error, 'session_restore');
        set({ user: null, isPreview: true, isGuest: true, isHydrated: true, error: message });
      }
    }).catch((error: unknown) => {
      const message = getAuthErrorMessage(error, 'session_restore');
      set({ isHydrated: true, isPreview: true, isGuest: true, error: message });
    });

    if (authListenerRegistered) return;
    authListenerRegistered = true;

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        set({ user: null, isPreview: true, isGuest: true });
        return;
      }
      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        window.setTimeout(() => void (async () => {
          const currentUser = get().user;
          if (currentUser && currentUser.id === session.user.id) {
            set({ isPreview: false, isGuest: false });
            return;
          }
          try {
            const profile = await resolveOrCreateProfile(session.user);
            set({ user: profile, isPreview: false, isGuest: false, error: null });
          } catch (error: unknown) {
            set({ error: getAuthErrorMessage(error, 'session_restore') });
          }
        })(), 0);
      }
    });
  },

  clearError: () => set({ error: null }),
}));
