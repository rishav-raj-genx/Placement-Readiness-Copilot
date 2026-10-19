'use client';

import { create } from 'zustand';
import type { UserProfile } from '@/types';
import { normalizeUserProfile } from '@/lib/profile-adapters';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';

export type SignUpResult = 'authenticated' | 'confirmation_required' | 'failed';

const PROFILE_COLUMNS = [
  'id', 'email', 'display_name', 'role', 'created_at', 'target_role', 'target_locations',
  'skills', 'github_username', 'resume_pdf_path', 'linkedin_pdf_path',
  'projects', 'co_curricular', 'onboarding_completed_at', 'updated_at',
].join(',');

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
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return normalizeUserProfile(data as unknown);
}

let authListenerRegistered = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isHydrated: false,
  isLoading: false,
  error: null,

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      if (!isSupabaseConfigured) {
        throw new Error(
          'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.'
        );
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      let profile = await fetchProfile(data.user.id);
      if (!profile) {
        const displayName = (data.user.user_metadata?.display_name as string | undefined) || email.split('@')[0];
        const { error: upsertError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email ?? email,
          display_name: displayName,
          role: 'student',
        }, { onConflict: 'id', ignoreDuplicates: true });
        if (upsertError) throw upsertError;
        profile = await fetchProfile(data.user.id);
      }
      if (!profile) {
        profile = {
          id: data.user.id,
          email: data.user.email ?? email,
          displayName: (data.user.user_metadata?.display_name as string | undefined) || email.split('@')[0],
          role: 'student',
          createdAt: data.user.created_at ?? new Date().toISOString(),
          targetLocations: [],
          skills: [],
          projects: [],
        };
      }

      set({ user: profile, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      set({ isLoading: false, error: message });
    }
  },

  signUp: async (email: string, password: string, displayName: string) => {
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
            : `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth?mode=signup&resume=1')}`,
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

      const profile = await fetchProfile(data.user.id);
      if (!profile) throw new Error('Failed to load profile after signup');

      set({ user: profile, isLoading: false });
      return 'authenticated';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      set({ isLoading: false, error: message });
      return 'failed';
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      set({ user: null, error: error?.message ?? null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Remote sign out failed.';
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
      const profile = await fetchProfile(authUser.id);
      set({ user: profile, isHydrated: true });
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to restore your session.';
      set({ isHydrated: true, error: message });
    });

    if (authListenerRegistered) return;
    authListenerRegistered = true;

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        set({ user: null });
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!session) return;
        (async () => {
          const currentUser = get().user;
          // Avoid re-fetching profile and re-rendering all components if token refreshed for same user
          if (currentUser && currentUser.id === session.user.id) {
            return;
          }
          const profile = await fetchProfile(session.user.id);
          if (profile) {
            set({ user: profile });
          }
        })();
      }
    });
  },

  clearError: () => set({ error: null }),
}));
