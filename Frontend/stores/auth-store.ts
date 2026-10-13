'use client';

import { create } from 'zustand';
import type { UserProfile, UserRole } from '@/types';
import { loadFromStorage, saveToStorage, removeFromStorage } from '@/lib/storage';
import { demoStudent, demoAdmin } from '@/lib/fixtures/users';
import { supabase } from '@/lib/supabase-client';

const DEMO_FLAG_KEY = 'auth-is-demo';

interface AuthState {
  user: UserProfile | null;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInDemo: (role: UserRole) => void;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => void;
  clearError: () => void;
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role as UserRole,
    createdAt: data.created_at,
  };
}

let authListenerRegistered = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isHydrated: false,
  isLoading: false,
  error: null,
  isDemoMode: false,

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const profile = await fetchProfile(data.user.id);
      if (!profile) {
        set({ isLoading: false, error: 'Profile not found. Please try signing up again.' });
        return;
      }

      set({ user: profile, isLoading: false, isDemoMode: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      set({ isLoading: false, error: message });
    }
  },

  signInDemo: (role: UserRole) => {
    const user = role === 'admin' ? demoAdmin : demoStudent;
    saveToStorage('auth-user', user);
    saveToStorage(DEMO_FLAG_KEY, true);
    // Write a lightweight cookie that middleware can read (localStorage is not visible to Edge functions)
    if (typeof document !== 'undefined') {
      document.cookie = `demo-session=${role}; path=/; SameSite=Lax`;
    }
    set({ user, isDemoMode: true });
  },

  signUp: async (email: string, password: string, displayName: string) => {
    set({ isLoading: true, error: null });
    try {
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

      set({ user: profile, isLoading: false, isDemoMode: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      set({ isLoading: false, error: message });
    }
  },

  signOut: async () => {
    const isDemo = get().isDemoMode;
    if (isDemo) {
      removeFromStorage('auth-user');
      removeFromStorage(DEMO_FLAG_KEY);
      // Clear the demo cookie so middleware stops letting demo users through
      if (typeof document !== 'undefined') {
        document.cookie = 'demo-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
      set({ user: null, isDemoMode: false });
      return;
    }
    await supabase.auth.signOut();
    set({ user: null });
  },

  hydrate: () => {
    const isDemo = loadFromStorage<boolean>(DEMO_FLAG_KEY, false);
    if (isDemo) {
      const user = loadFromStorage<UserProfile | null>('auth-user', null);
      set({ user, isHydrated: true, isDemoMode: true });
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        set({ isHydrated: true });
        return;
      }
      const profile = await fetchProfile(session.user.id);
      set({ user: profile, isHydrated: true });
    }).catch(() => {
      set({ isHydrated: true });
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
          const profile = await fetchProfile(session.user.id);
          if (profile) set({ user: profile });
        })();
      }
    });
  },

  clearError: () => set({ error: null }),
}));
