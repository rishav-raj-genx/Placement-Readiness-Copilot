-- Migration: ensure_leetcode_url_column
-- Idempotently ensures leetcode_url, coding_profile_url, and linkedin_text exist on profiles table

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS leetcode_url TEXT,
  ADD COLUMN IF NOT EXISTS coding_profile_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_text TEXT;

-- Index leetcode_url for fast profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_leetcode_url
  ON public.profiles(leetcode_url)
  WHERE leetcode_url IS NOT NULL;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
