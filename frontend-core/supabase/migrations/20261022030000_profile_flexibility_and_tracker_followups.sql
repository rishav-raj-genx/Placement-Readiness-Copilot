-- Migration: profile_flexibility_and_tracker_followups
-- Adds flexible profile text fields and application tracker follow-up date

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linkedin_text TEXT,
  ADD COLUMN IF NOT EXISTS leetcode_url TEXT,
  ADD COLUMN IF NOT EXISTS coding_profile_url TEXT;

ALTER TABLE public.application_tracker
  ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_app_tracker_follow_up
  ON public.application_tracker(follow_up_date);

NOTIFY pgrst, 'reload schema';
