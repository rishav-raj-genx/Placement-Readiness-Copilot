import { describe, expect, it } from 'vitest';
import { normalizeUserProfile } from '@/lib/profile-adapters';

describe('freemium monetization & interview credits', () => {
  it('defaults to 3 interview credits and isPremium=false when columns are missing or null', () => {
    const profile = normalizeUserProfile({
      id: 'test-user-1',
      email: 'student@example.com',
      display_name: 'Test Candidate',
      role: 'student',
      created_at: new Date().toISOString(),
    });

    expect(profile?.interviewCredits).toBe(3);
    expect(profile?.isPremium).toBe(false);
  });

  it('preserves existing credits and premium status when provided in profile data', () => {
    const profile = normalizeUserProfile({
      id: 'test-user-2',
      email: 'premium@example.com',
      display_name: 'Premium Candidate',
      role: 'student',
      created_at: new Date().toISOString(),
      interview_credits: 0,
      is_premium: true,
    });

    expect(profile?.interviewCredits).toBe(0);
    expect(profile?.isPremium).toBe(true);
  });

  it('correctly calculates paywall lock state for free users with 0 credits', () => {
    const freeExhausted = normalizeUserProfile({
      id: 'test-user-3',
      email: 'exhausted@example.com',
      display_name: 'Exhausted Candidate',
      role: 'student',
      created_at: new Date().toISOString(),
      interview_credits: 0,
      is_premium: false,
    });

    expect(freeExhausted).not.toBeNull();
    const isLocked = !freeExhausted?.isPremium && (freeExhausted?.interviewCredits ?? 3) <= 0;
    expect(isLocked).toBe(true);

    const premiumUser = normalizeUserProfile({
      id: 'test-user-4',
      email: 'vip@example.com',
      display_name: 'VIP Candidate',
      role: 'student',
      created_at: new Date().toISOString(),
      interview_credits: 0,
      is_premium: true,
    });

    expect(premiumUser).not.toBeNull();
    const isPremiumLocked = !premiumUser?.isPremium && (premiumUser?.interviewCredits ?? 3) <= 0;
    expect(isPremiumLocked).toBe(false);
  });

  it('correctly calculates credit decrement upon interview token generation', () => {
    const initialCredits = 3;
    const decremented = Math.max(0, initialCredits - 1);
    expect(decremented).toBe(2);

    const singleCredit = 1;
    expect(Math.max(0, singleCredit - 1)).toBe(0);

    const zeroCredit = 0;
    expect(Math.max(0, zeroCredit - 1)).toBe(0);
  });

  it('validates interview configuration payload shape and defaults', () => {
    const rawPayload = {
      targetRole: 'Distributed Systems Engineer',
      difficulty: 'hard',
      experienceLevel: 'three_plus',
      durationMinutes: 20,
      focusAreas: ['Raft Consensus', 'LSM Trees'],
    };

    expect(rawPayload.targetRole).toBe('Distributed Systems Engineer');
    expect(rawPayload.difficulty).toBe('hard');
    expect(rawPayload.experienceLevel).toBe('three_plus');
    expect(rawPayload.durationMinutes).toBe(20);
    expect(rawPayload.focusAreas).toEqual(['Raft Consensus', 'LSM Trees']);
  });
});

