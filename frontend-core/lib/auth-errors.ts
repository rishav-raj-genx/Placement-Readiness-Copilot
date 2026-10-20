export type AuthOperation = 'sign_in' | 'sign_up' | 'session_restore' | 'sign_out';

interface AuthErrorDetails {
  message?: unknown;
  code?: unknown;
  status?: unknown;
}

const FALLBACK_MESSAGES: Record<AuthOperation, string> = {
  sign_in: 'Sign in failed. Please try again.',
  sign_up: 'Account creation failed. Please try again.',
  session_restore: 'Your session could not be restored. Please sign in again.',
  sign_out: 'Sign out failed. Please try again.',
};

function getErrorDetails(error: unknown): AuthErrorDetails {
  if (typeof error === 'object' && error !== null) {
    const details = error as AuthErrorDetails;
    return {
      message: error instanceof Error ? error.message : details.message,
      code: details.code,
      status: details.status,
    };
  }
  return {};
}

export function getAuthErrorMessage(error: unknown, operation: AuthOperation): string {
  const details = getErrorDetails(error);
  const message = typeof details.message === 'string' ? details.message.trim() : '';
  const code = typeof details.code === 'string' ? details.code.toLowerCase() : '';
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes('failed to fetch')
    || normalizedMessage.includes('network request failed')
    || normalizedMessage.includes('networkerror')
    || normalizedMessage.includes('load failed')
  ) {
    return 'Unable to reach the authentication service. Check your connection and try again.';
  }
  if (code === 'invalid_credentials' || normalizedMessage.includes('invalid login credentials')) {
    return 'Email or password is incorrect.';
  }
  if (code === 'email_not_confirmed' || normalizedMessage.includes('email not confirmed')) {
    return 'Confirm your email before signing in.';
  }
  if (code === 'user_already_exists' || normalizedMessage.includes('already registered')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (details.status === 429 || code.includes('rate_limit') || normalizedMessage.includes('rate limit')) {
    return 'Too many authentication attempts. Wait a moment and try again.';
  }

  return message || FALLBACK_MESSAGES[operation];
}
