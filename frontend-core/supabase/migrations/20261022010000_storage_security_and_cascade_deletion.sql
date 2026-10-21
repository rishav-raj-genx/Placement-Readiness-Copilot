-- Migration: storage_security_and_cascade_deletion
-- Enforces private bucket access, adds missing DELETE RLS policies for owner cleanup,
-- and defines delete_user_account() RPC for cascading account and storage purge.

-- 1. Enforce private bucket for interview_recordings and candidate-documents
UPDATE storage.buckets
SET public = false
WHERE id IN ('interview_recordings', 'candidate-documents');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'interview_recordings',
  'interview_recordings',
  false,
  104857600,
  ARRAY['audio/webm']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false;

-- 2. Owner DELETE RLS Policies
-- Profiles: Allow user to delete their own profile
DROP POLICY IF EXISTS "delete_own_profile" ON public.profiles;
CREATE POLICY "delete_own_profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Interview Sessions: Allow student to delete their own sessions
DROP POLICY IF EXISTS "Students can delete own interview sessions" ON public.interview_sessions;
CREATE POLICY "Students can delete own interview sessions"
  ON public.interview_sessions FOR DELETE
  TO authenticated
  USING (auth.uid()::text = student_id OR auth.uid() = user_id);

-- Readiness Scores: Allow student to delete their own readiness scores
DROP POLICY IF EXISTS "Students can delete own readiness scores" ON public.readiness_scores;
CREATE POLICY "Students can delete own readiness scores"
  ON public.readiness_scores FOR DELETE
  TO authenticated
  USING (auth.uid()::text = student_id);

-- Project Live Checks: Allow student to delete their own checks
DROP POLICY IF EXISTS "Students can delete own live checks" ON public.project_live_checks;
CREATE POLICY "Students can delete own live checks"
  ON public.project_live_checks FOR DELETE
  TO authenticated
  USING (auth.uid()::text = student_id);

-- Mock Interview Results: Allow student to delete their own mock results
DROP POLICY IF EXISTS "Students can delete own mock results" ON public.mock_interview_results;
CREATE POLICY "Students can delete own mock results"
  ON public.mock_interview_results FOR DELETE
  TO authenticated
  USING (auth.uid()::text = student_id);

-- Candidate Profile Reviews: Allow student to delete their own reviews
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'candidate_profile_reviews'
  ) THEN
    EXECUTE '
      DROP POLICY IF EXISTS "Students can delete own candidate profile reviews" ON public.candidate_profile_reviews;
      CREATE POLICY "Students can delete own candidate profile reviews"
        ON public.candidate_profile_reviews FOR DELETE
        TO authenticated
        USING (auth.uid() = user_id OR auth.uid()::text = student_id);
    ';
  END IF;
END $$;

-- Application Tracker: Allow student to delete own applications (ensure DELETE policy is distinct)
DROP POLICY IF EXISTS "Students can delete own applications" ON public.application_tracker;
CREATE POLICY "Students can delete own applications"
  ON public.application_tracker FOR DELETE
  TO authenticated
  USING (auth.uid()::text = student_id);

-- 3. Cascade Account Deletion RPC
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
    calling_user_id UUID;
BEGIN
    calling_user_id := auth.uid();
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Purge storage objects belonging to user from private buckets
    DELETE FROM storage.objects
    WHERE bucket_id IN ('interview_recordings', 'candidate-documents')
      AND (
        (storage.foldername(name))[1] = calling_user_id::text
        OR owner = calling_user_id
        OR name LIKE calling_user_id::text || '/%'
      );

    -- Purge all related student-owned rows
    DELETE FROM public.readiness_scores WHERE student_id = calling_user_id::text;
    DELETE FROM public.project_live_checks WHERE student_id = calling_user_id::text;
    DELETE FROM public.application_tracker WHERE student_id = calling_user_id::text;
    DELETE FROM public.mock_interview_results WHERE student_id = calling_user_id::text;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'candidate_profile_reviews'
    ) THEN
      DELETE FROM public.candidate_profile_reviews
      WHERE user_id = calling_user_id OR student_id = calling_user_id::text;
    END IF;

    DELETE FROM public.interview_sessions
    WHERE user_id = calling_user_id OR student_id = calling_user_id::text;

    DELETE FROM public.profiles WHERE id = calling_user_id;

    -- Delete from auth.users (cascades any remaining foreign keys)
    DELETE FROM auth.users WHERE id = calling_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

NOTIFY pgrst, 'reload schema';
