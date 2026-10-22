import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import { loadFromStorage, saveToStorage } from '@/lib/storage';
import { useAuthStore } from '@/stores/auth-store';

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getTourKey(userId?: string | null): string {
  const cleanId = userId?.trim();
  return cleanId ? `hireable_tour_${cleanId}` : 'hireable_tour_guest';
}

export interface TourStatusOptions {
  userId?: string | null;
  onboardingCompletedAt?: string | null;
}

export function isTourCompleted(options?: TourStatusOptions): boolean {
  if (typeof window === 'undefined') return false;

  const cleanId = options?.userId?.trim();

  // 1. For authenticated users, check profile onboarding status or per-user cookie/storage
  if (cleanId) {
    if (options?.onboardingCompletedAt) {
      return true;
    }
    const userCookie = getCookie(`hireable_tour_${cleanId}`);
    if (userCookie === 'completed' || userCookie === 'true') {
      return true;
    }
    return loadFromStorage<boolean>(`hireable_tour_${cleanId}`, false);
  }

  // 2. For guest / unauthenticated users, strictly check guest cookie or storage
  const guestCookie = getCookie('hireable_tour_guest');
  if (guestCookie === 'completed' || guestCookie === 'true') {
    return true;
  }

  const guestLocal = loadFromStorage<boolean>('hireable_tour_guest', false);
  if (guestLocal) {
    return true;
  }

  return loadFromStorage<boolean>('has_seen_intro', false);
}

export async function setTourCompleted(userId?: string | null): Promise<void> {
  const cleanId = userId?.trim();
  const key = getTourKey(cleanId);
  const now = new Date().toISOString();

  // 1. Store per-user cookie (1 year duration)
  setCookie(key, 'completed', 365);

  // 2. Store user-scoped storage
  saveToStorage(key, true);

  // If guest, also maintain legacy storage for backward-compatibility with existing tests
  if (!cleanId) {
    saveToStorage('has_seen_intro', true);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('has_seen_intro', 'true');
      } catch {
        // ignore
      }
    }
  }

  // 3. If authenticated user, persist to database profile and update auth store state
  if (cleanId) {
    try {
      if (isSupabaseConfigured) {
        await supabase
          .from('profiles')
          .update({ onboarding_completed_at: now })
          .eq('id', cleanId);
      }
    } catch {
      // non-blocking in offline / test environments
    }

    const state = useAuthStore.getState();
    if (state.user && state.user.id === cleanId) {
      useAuthStore.setState({
        user: { ...state.user, onboardingCompletedAt: now },
      });
    }
  }
}
