import { describe, expect, it } from 'vitest';
import {
  normalizeUserProfile,
  PROFILE_SELECT_COLUMNS,
  PROFILE_SAFE_FALLBACK_COLUMNS,
} from '@/lib/profile-adapters';
import type { UserProfile } from '@/types';

describe('Profile Schema Synchronization (linkedin_text & fallback resilience)', () => {
  it('includes linkedin_text and linkedin_url in primary PROFILE_SELECT_COLUMNS', () => {
    const columns = PROFILE_SELECT_COLUMNS.split(',');
    expect(columns).toContain('linkedin_text');
    expect(columns).toContain('linkedin_url');
  });

  it('provides safe fallback columns excluding linkedin_text for resilient retries', () => {
    const fallbackCols = PROFILE_SAFE_FALLBACK_COLUMNS.split(',');
    expect(fallbackCols).not.toContain('linkedin_text');
    expect(fallbackCols).toContain('id');
    expect(fallbackCols).toContain('email');
    expect(fallbackCols).toContain('display_name');
  });

  it('normalizes linkedin_text and linkedin_url into both camelCase and snake_case properties', () => {
    const raw = {
      id: 'student-uuid-123',
      email: 'alex@example.com',
      display_name: 'Alex Johnson',
      role: 'student',
      created_at: '2026-10-22T08:00:00Z',
      linkedin_text: 'Experienced Full-Stack Engineer with React and Python skills.',
      linkedin_url: 'https://www.linkedin.com/in/alex-johnson',
    };

    const profile: UserProfile | null = normalizeUserProfile(raw);
    expect(profile).not.toBeNull();
    expect(profile?.linkedinText).toBe('Experienced Full-Stack Engineer with React and Python skills.');
    expect(profile?.linkedin_text).toBe('Experienced Full-Stack Engineer with React and Python skills.');
    expect(profile?.linkedinUrl).toBe('https://www.linkedin.com/in/alex-johnson');
    expect(profile?.linkedin_url).toBe('https://www.linkedin.com/in/alex-johnson');
  });

  it('gracefully handles null or missing linkedin_text without crashing', () => {
    const rawMissing = {
      id: 'student-uuid-456',
      email: 'sara@example.com',
      display_name: 'Sara Lee',
      role: 'student',
      created_at: '2026-10-22T08:00:00Z',
      linkedin_text: null,
      linkedin_url: null,
    };

    const profile = normalizeUserProfile(rawMissing);
    expect(profile).not.toBeNull();
    expect(profile?.linkedinText).toBeUndefined();
    expect(profile?.linkedin_text).toBeNull();
    expect(profile?.linkedinUrl).toBeUndefined();
    expect(profile?.linkedin_url).toBeNull();
  });
});
