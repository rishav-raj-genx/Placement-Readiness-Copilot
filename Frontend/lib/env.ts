/**
 * lib/env.ts — Environment Variable Validation
 *
 * Provides a validateServerEnv() function for server-side routes to call at
 * request time (NOT at import time). Calling at import time breaks Next.js
 * builds because "collecting page data" imports the module without env vars.
 *
 * Usage (server-side files only):
 *   import { validateServerEnv } from '@/lib/env';
 *   // Inside a request handler:
 *   validateServerEnv();
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

export function validateServerEnv(): void {
  const allRequired = [...REQUIRED_PUBLIC, ...REQUIRED_SERVER];
  const missing = allRequired.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Set them in your Vercel project settings (or .env.local for local dev).'
    );
  }

  const dangerouslyExposed = REQUIRED_SERVER.filter(
    (key) => `NEXT_PUBLIC_${key}` in process.env
  );

  if (dangerouslyExposed.length > 0) {
    throw new Error(
      `Security violation: server secrets exposed as NEXT_PUBLIC_ variables: ${dangerouslyExposed.join(', ')}`
    );
  }
}
