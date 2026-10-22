'use client';

import { create } from 'zustand';
import type { UserProfile } from '@/types';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import { normalizeUserProfile, PROFILE_SELECT_COLUMNS } from '@/lib/profile-adapters';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';

export type SignUpResult = 'authenticated' | 'confirmation_required' | 'failed';

interface AuthState {
  user: UserProfile | null;
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
  if (error) throw error;
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

      set({ user: profile, isLoading: false });
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
        set({ user: null, isLoading: false });
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

      set({ user: profile, isLoading: false });
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
      set({ user: null, error: error ? getAuthErrorMessage(error, 'sign_out') : null });
    } catch (error: unknown) {
      const message = getAuthErrorMessage(error, 'sign_out');
      set({ user: null, error: message });
    }
  },

  hydrate: () => {
    if (!isSupabaseConfigured) {
      set({ isHydrated: true });
      return;
    }

    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!authUser) {
        set({ user: null, isHydrated: true });
        return;
      }
      const profile = await resolveOrCreateProfile(authUser);
      set({ user: profile, isHydrated: true });
    }).catch((error: unknown) => {
      const message = getAuthErrorMessage(error, 'session_restore');
      set({ isHydrated: true, error: message });
    });

    if (authListenerRegistered) return;
    authListenerRegistered = true;

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        set({ user: null });
        return;
      }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (!session) return;
        window.setTimeout(() => void (async () => {
          const currentUser = get().user;
          if (currentUser && currentUser.id === session.user.id) {
            return;
          }
          try {
            const profile = await resolveOrCreateProfile(session.user);
            set({ user: profile, error: null });
          } catch (error: unknown) {
            set({ error: getAuthErrorMessage(error, 'session_restore') });
          }
        })(), 0);
      }
    });
  },

  clearError: () => set({ error: null }),
}));
