-- Migration: 20261022070000_fk_interview_sessions_profiles.sql
-- Enables PostgREST joins between interview_sessions and profiles for faculty reviews (profiles(name, email, github_handle))

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS github_handle TEXT;

UPDATE public.profiles
SET
  name = COALESCE(name, display_name),
  github_handle = COALESCE(github_handle, github_username);

CREATE OR REPLACE FUNCTION public.sync_profile_name_and_github_handle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.name IS NULL OR NEW.name = '' THEN
    NEW.name := NEW.display_name;
  END IF;
  IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
    NEW.display_name := COALESCE(NEW.name, split_part(NEW.email, '@', 1));
  END IF;
  IF NEW.github_handle IS NULL OR NEW.github_handle = '' THEN
    NEW.github_handle := NEW.github_username;
  END IF;
  IF NEW.github_username IS NULL OR NEW.github_username = '' THEN
    NEW.github_username := NEW.github_handle;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_name_and_github_handle ON public.profiles;
CREATE TRIGGER trg_sync_profile_name_and_github_handle
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_name_and_github_handle();

-- Ensure foreign key constraint between interview_sessions and profiles for Supabase PostgREST joining
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_interview_sessions_user_profile'
  ) THEN
    ALTER TABLE public.interview_sessions
      ADD CONSTRAINT fk_interview_sessions_user_profile
      FOREIGN KEY (user_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
