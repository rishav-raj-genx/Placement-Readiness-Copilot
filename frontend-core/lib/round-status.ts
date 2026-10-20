import { supabase } from '@/lib/supabase-client';

const ROUND1_KEY_PREFIX = 'round1_completed_';
const ROUND1_GLOBAL_KEY = 'round1_completed_global';

export function isLocalRound1Completed(userId?: string): boolean {
  if (typeof window === 'undefined') return false;
  if (window.localStorage.getItem(ROUND1_GLOBAL_KEY) === 'true') return true;
  if (userId && window.localStorage.getItem(`${ROUND1_KEY_PREFIX}${userId}`) === 'true') return true;
  return false;
}

export function markRound1Completed(userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ROUND1_GLOBAL_KEY, 'true');
    if (userId) {
      window.localStorage.setItem(`${ROUND1_KEY_PREFIX}${userId}`, 'true');
    }
  } catch (err) {
    console.warn('Failed to record round 1 completion in local storage:', err);
  }
}

export async function checkRound1Completed(userId?: string): Promise<boolean> {
  if (isLocalRound1Completed(userId)) return true;

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('interview_sessions')
        .select('id, status, result')
        .eq('user_id', userId)
        .or('status.eq.completed,result.not.is.null')
        .limit(1);

      if (!error && data && data.length > 0) {
        markRound1Completed(userId);
        return true;
      }
    } catch {
      // Gracefully fall back to local state
    }
  }

  return false;
}
