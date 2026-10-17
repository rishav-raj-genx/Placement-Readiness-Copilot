'use client';

import { create } from 'zustand';
import type { UserProfile, UserRole } from '@/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import { setAuthCookies, clearAllAuthCookies } from '@/lib/auth-cookies';

export type SignUpResult = 'authenticated' | 'confirmation_required' | 'failed';

type ProfileRecord = Record<string, unknown>;

function isProfileRecord(value: unknown): value is ProfileRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'student' || value === 'admin';
}

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
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, role, created_at')
      .eq('id', userId)
      .maybeSingle();

    const profileData: unknown = data;
    if (
      !error &&
      isProfileRecord(profileData) &&
      typeof profileData.id === 'string' &&
      typeof profileData.email === 'string' &&
      typeof profileData.display_name === 'string' &&
      typeof profileData.created_at === 'string' &&
      isUserRole(profileData.role)
    ) {
      return {
        id: profileData.id,
        email: profileData.email,
        displayName: profileData.display_name,
        role: profileData.role,
        createdAt: profileData.created_at,
      };
    }
  } catch {
    // Ignore schema cache or network error on profiles table
  }

  return null;
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

      const profile = await fetchProfile(data.user.id);
      if (!profile) throw new Error('Your account profile is unavailable. Please contact support.');

      if (data.session) {
        setAuthCookies(data.session);
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
        options: { data: { display_name: displayName } },
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

      if (data.session) {
        setAuthCookies(data.session);
      }

      set({ user: profile, isLoading: false });
      return 'authenticated';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      set({ isLoading: false, error: message });
      return 'failed';
    }
  },

  signOut: async () => {
    clearAllAuthCookies();
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

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        clearAllAuthCookies();
        set({ user: null, isHydrated: true });
        return;
      }
      const profile = await fetchProfile(session.user.id);
      if (profile) {
        setAuthCookies(session);
      }
      if (!profile) clearAllAuthCookies();
      set({ user: profile, isHydrated: true });
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to restore your session.';
      set({ isHydrated: true, error: message });
    });

    if (authListenerRegistered) return;
    authListenerRegistered = true;

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearAllAuthCookies();
        set({ user: null });
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!session) return;
        (async () => {
          const profile = await fetchProfile(session.user.id);
          if (profile) {
            setAuthCookies(session);
            set({ user: profile });
          }
        })();
      }
    });
  },

  clearError: () => set({ error: null }),
}));
