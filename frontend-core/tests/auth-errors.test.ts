import { describe, expect, it } from 'vitest';
import { getAuthErrorMessage } from '@/lib/auth-errors';

describe('authentication error messages', () => {
  it('turns fetch failures into an actionable connection message', () => {
    expect(getAuthErrorMessage(new TypeError('Failed to fetch'), 'sign_in')).toBe(
      'Unable to reach the authentication service. Check your connection and try again.',
    );
  });

  it('maps common Supabase auth failures without exposing implementation details', () => {
    expect(getAuthErrorMessage({ code: 'invalid_credentials' }, 'sign_in')).toBe(
      'Email or password is incorrect.',
    );
    expect(getAuthErrorMessage({ message: 'User already registered' }, 'sign_up')).toBe(
      'An account with this email already exists. Sign in instead.',
    );
    expect(getAuthErrorMessage({ status: 429 }, 'sign_up')).toBe(
      'Too many authentication attempts. Wait a moment and try again.',
    );
  });

  it('uses operation-specific fallbacks for unknown failures', () => {
    expect(getAuthErrorMessage(null, 'session_restore')).toBe(
      'Your session could not be restored. Please sign in again.',
    );
  });
});
