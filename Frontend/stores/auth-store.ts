'use client';

import { create } from 'zustand';
import type { UserProfile, UserRole } from '@/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import { setAuthCookies, clearAllAuthCookies } from '@/lib/auth-cookies';

interface AuthState {
  user: UserProfile | null;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
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

    if (!error && data) {
      return {
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        role: data.role as UserRole,
        createdAt: data.created_at,
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

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Sign up failed — no user returned');

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        display_name: displayName,
        role: 'student',
      });

      if (profileError) throw profileError;

      const profile = await fetchProfile(data.user.id);
      if (!profile) throw new Error('Failed to load profile after signup');

      if (data.session) {
        setAuthCookies(data.session);
      }

      set({ user: profile, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      set({ isLoading: false, error: message });
    }
  },

  signOut: async () => {
    clearAllAuthCookies();
    await supabase.auth.signOut().catch(() => {});
    set({ user: null });
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
    }).catch(() => {
      set({ isHydrated: true });
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
