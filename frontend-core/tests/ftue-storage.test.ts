import { beforeEach, describe, expect, it } from 'vitest';
import { loadFromStorage, removeFromStorage, saveToStorage } from '@/lib/storage';

describe('FTUE persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows the intro until the completion flag is stored', () => {
    expect(loadFromStorage('has_seen_intro', false)).toBe(false);
    saveToStorage('has_seen_intro', true);
    expect(loadFromStorage('has_seen_intro', false)).toBe(true);
    removeFromStorage('has_seen_intro');
    expect(loadFromStorage('has_seen_intro', false)).toBe(false);
  });
});
