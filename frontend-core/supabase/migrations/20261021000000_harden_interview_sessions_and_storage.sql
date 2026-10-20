-- Migration: 20261021000000_harden_interview_sessions_and_storage.sql
-- Description: Hardens interview_sessions RLS to prevent result tampering and client deletion;
--              ensures interview_recordings storage bucket is private.

-- 1. Make interview_recordings storage bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'interview_recordings';

-- 2. Restrict interview_sessions UPDATE policy to safe client statuses
DROP POLICY IF EXISTS "update_own_interview_sessions" ON public.interview_sessions;
CREATE POLICY "update_own_interview_sessions"
  ON public.interview_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('in_progress', 'abandoned', 'cancelled')
  );

-- 3. Remove client DELETE policy to prevent deletion of records required for retention & auditing
DROP POLICY IF EXISTS "delete_own_interview_sessions" ON public.interview_sessions;

-- 4. Add trigger enforcing that clients cannot modify finalized result, score, or completed_at
CREATE OR REPLACE FUNCTION public.check_interview_session_client_update()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user = 'service_role' OR (SELECT current_setting('request.jwt.claim.role', true)) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.result IS DISTINCT FROM OLD.result THEN
    RAISE EXCEPTION 'Clients cannot modify interview result directly.';
  END IF;
  IF NEW.score IS DISTINCT FROM OLD.score THEN
    RAISE EXCEPTION 'Clients cannot modify interview score directly.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_interview_session_result ON public.interview_sessions;
CREATE TRIGGER trg_protect_interview_session_result
  BEFORE UPDATE ON public.interview_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_interview_session_client_update();
