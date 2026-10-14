'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Keep demo-mode pages renderable when a developer has not configured Supabase.
// Authenticated operations still fail with a clear network error until the
// public project URL and anon key are supplied in .env.local.
export const supabase = createClient(
  supabaseUrl || 'https://local-demo.invalid',
  supabaseAnonKey || 'local-demo-anon-key'
);
