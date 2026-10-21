import { beforeEach, describe, expect, it } from 'vitest';
import { loadFromStorage, removeFromStorage, saveToStorage } from '@/lib/storage';
import { getCookie, isTourCompleted, setTourCompleted } from '@/lib/tour-storage';

describe('FTUE persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = '';
  });

  it('shows the intro until the completion flag is stored and persists per authenticated user', async () => {
    expect(loadFromStorage('has_seen_intro', false)).toBe(false);
    saveToStorage('has_seen_intro', true);
    expect(loadFromStorage('has_seen_intro', false)).toBe(true);
    removeFromStorage('has_seen_intro');
    expect(loadFromStorage('has_seen_intro', false)).toBe(false);

    // Guest persistence via tour-storage
    expect(isTourCompleted()).toBe(false);
    await setTourCompleted();
    expect(isTourCompleted()).toBe(true);

    // Isolated per authenticated user
    expect(isTourCompleted({ userId: 'user-456' })).toBe(false);
    expect(isTourCompleted({ userId: 'user-789', onboardingCompletedAt: '2026-10-22T00:00:00Z' })).toBe(true);

    await setTourCompleted('user-456');
    expect(isTourCompleted({ userId: 'user-456' })).toBe(true);
    expect(getCookie('hireable_tour_user-456')).toBe('completed');
  });
});
