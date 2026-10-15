'use client';

import { create } from 'zustand';
import type { UserProfile, UserRole } from '@/types';
import { loadFromStorage, saveToStorage, removeFromStorage } from '@/lib/storage';
import { demoStudent, demoAdmin } from '@/lib/fixtures/users';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import { setAuthCookies, setDemoCookies, clearAllAuthCookies } from '@/lib/auth-cookies';

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

async function fetchProfile(userId: string, userFallback?: any): Promise<UserProfile | null> {
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

  // Graceful fallback to verified user metadata from Supabase Auth
  if (userFallback) {
    return {
      id: userFallback.id,
      email: userFallback.email || '',
      displayName:
        userFallback.user_metadata?.display_name ||
        userFallback.user_metadata?.full_name ||
        userFallback.email?.split('@')[0] ||
        'Student',
      role: (userFallback.user_metadata?.role as UserRole) || 'student',
      createdAt: userFallback.created_at || new Date().toISOString(),
    };
  }

  return null;
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
      if (!isSupabaseConfigured) {
        throw new Error(
          'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.'
        );
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const profile = (await fetchProfile(data.user.id, data.user)) || {
        id: data.user.id,
        email: data.user.email || email,
        displayName: data.user.user_metadata?.display_name || email.split('@')[0],
        role: (data.user.user_metadata?.role as UserRole) || 'student',
        createdAt: data.user.created_at || new Date().toISOString(),
      };

      if (data.session) {
        setAuthCookies(data.session, profile.role);
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
    setDemoCookies(role);
    set({ user, isDemoMode: true });
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
        setAuthCookies(data.session, profile.role);
      }

      set({ user: profile, isLoading: false, isDemoMode: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      set({ isLoading: false, error: message });
    }
  },

  signOut: async () => {
    removeFromStorage('auth-user');
    removeFromStorage(DEMO_FLAG_KEY);
    clearAllAuthCookies();

    const isDemo = get().isDemoMode;
    if (!isDemo) {
      await supabase.auth.signOut().catch(() => {});
    }
    set({ user: null, isDemoMode: false });
  },

  hydrate: () => {
    const isDemo = loadFromStorage<boolean>(DEMO_FLAG_KEY, false);
    if (isDemo) {
      const user = loadFromStorage<UserProfile | null>('auth-user', null);
      if (user) {
        setDemoCookies(user.role);
      }
      set({ user, isHydrated: true, isDemoMode: true });
      return;
    }

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
      const profile = await fetchProfile(session.user.id, session.user);
      if (profile) {
        setAuthCookies(session, profile.role);
      }
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
          const profile = await fetchProfile(session.user.id, session.user);
          if (profile) {
            setAuthCookies(session, profile.role);
            set({ user: profile });
          }
        })();
      }
    });
  },

  clearError: () => set({ error: null }),
}));
