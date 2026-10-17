/**
 * lib/env.ts — Environment Variable Security & Validation
 *
 * Enforces strict boundary between client-safe variables and server-only secrets.
 *
 * Rules:
 *  - Client variables MUST be prefixed with NEXT_PUBLIC_
 *  - Server secrets MUST NEVER have NEXT_PUBLIC_ prefix
 *  - Server secrets MUST NEVER be imported into client components
 */

const REQUIRED_PUBLIC: (keyof NodeJS.ProcessEnv)[] = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_LIVEKIT_URL',
];

const REQUIRED_SERVER: (keyof NodeJS.ProcessEnv)[] = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
];

/**
 * Known server-only secret keys that must never have a NEXT_PUBLIC_ counterpart.
 */
export const SERVER_SECRETS_DENYLIST: string[] = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'GROQ_API_KEY',
  'DEEPGRAM_API_KEY',
  'OPENAI_API_KEY',
];

/**
 * Validates that no server secrets have accidentally been given a NEXT_PUBLIC_ prefix.
 * Throws a fatal security error if any violation is detected.
 */
export function assertNoServerSecretsExposed(): void {
  const exposed = SERVER_SECRETS_DENYLIST.filter(
    (key) => `NEXT_PUBLIC_${key}` in process.env
  );

  if (exposed.length > 0) {
    throw new Error(
      `CRITICAL SECURITY VIOLATION: Server secret(s) exposed with NEXT_PUBLIC_ prefix: ${exposed.join(', ')}. ` +
      'Remove NEXT_PUBLIC_ prefix immediately to prevent leaking secrets to browser bundles.'
    );
  }
}

/**
 * Call inside server route handlers at request time (not at module root).
 */
export function validateServerEnv(): void {
  assertNoServerSecretsExposed();

  const allRequired = [...REQUIRED_PUBLIC, ...REQUIRED_SERVER];
  const missing = allRequired.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Set them in your deployment environment settings (or .env.local for local dev).'
    );
  }
}
