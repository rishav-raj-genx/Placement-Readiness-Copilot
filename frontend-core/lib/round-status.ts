import { supabase } from '@/lib/supabase-client';
import { isInterviewRecord, isInterviewSessionCompleted } from '@/lib/interview-history';

const ROUND1_KEY_PREFIX = 'round1_completed_';

export function isLocalRound1Completed(userId?: string): boolean {
  return Boolean(
    typeof window !== 'undefined'
    && userId
    && window.localStorage.getItem(`${ROUND1_KEY_PREFIX}${userId}`) === 'true',
  );
}

export function markRound1Completed(userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (userId) {
      window.localStorage.setItem(`${ROUND1_KEY_PREFIX}${userId}`, 'true');
    }
  } catch (err) {
    console.warn('Failed to record round 1 completion in local storage:', err);
  }
}

export async function checkRound1Completed(userId?: string): Promise<boolean> {
  if (userId) {
    try {
      const { data, error } = await supabase
        .from('interview_sessions')
        .select('id, status, result, completed_at, config')
        .or(`user_id.eq.${userId},student_id.eq.${userId}`)
        .limit(20);

      const completedViva = !error && Array.isArray(data) && data.some((session) => {
        const config = isInterviewRecord(session.config) ? session.config : {};
        return isInterviewSessionCompleted(session) && config.type !== 'coding' && config.round !== 2;
      });
      if (completedViva) {
        markRound1Completed(userId);
        return true;
      }
    } catch {
      // Gracefully fall back to local state
    }
  }

  return false;
}
