/**
 * lib/supabase-server.ts
 *
 * Server-side Supabase client using the SERVICE ROLE KEY.
 *
 * ⚠️  ONLY import this file in:
 *      - app/api/*\/route.ts  (Next.js API routes)
 *      - middleware.ts
 *      - Server Components (not 'use client' files)
 *
 * This client bypasses Row Level Security — use it only for
 * admin operations that require elevated privileges.
 *
 * The browser client (lib/supabase-client.ts) uses the anon key
 * and is safe for client components.
 */

import { validateServerEnv } from '@/lib/env';
import { createClient } from '@supabase/supabase-js';

export function createServerClient() {
  validateServerEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      '[supabase-server] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable auto-refresh and session persistence — server clients are stateless
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
