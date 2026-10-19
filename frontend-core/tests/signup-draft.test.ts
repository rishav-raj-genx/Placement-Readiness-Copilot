import { beforeEach, describe, expect, it } from 'vitest';
import { loadPendingSignupDraft, savePendingSignupDraft } from '@/lib/signup-draft';

describe('signup draft persistence', () => {
  beforeEach(() => window.localStorage.clear());

  it('restores only non-secret signup fields', () => {
    savePendingSignupDraft({
      displayName: 'Asha Rao',
      email: 'asha@example.com',
      targetRole: 'Frontend Engineer',
      githubUsername: 'asha-rao',
    });

    expect(loadPendingSignupDraft()).toEqual({
      displayName: 'Asha Rao',
      email: 'asha@example.com',
      targetRole: 'Frontend Engineer',
      githubUsername: 'asha-rao',
    });
    expect(window.localStorage.getItem('hireable:pending-signup')).not.toContain('password');
  });

  it('rejects malformed persisted data', () => {
    window.localStorage.setItem('hireable:pending-signup', '{broken');
    expect(loadPendingSignupDraft()).toBeNull();
  });
});
