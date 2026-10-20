-- Migration: 20261021000000_harden_interview_sessions_and_storage.sql
-- Description: Hardens interview_sessions RLS to prevent result tampering and client deletion;
--              ensures interview_recordings storage bucket is private.

-- 1. Make interview_recordings storage bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'interview_recordings';

-- 2. Restrict interview_sessions UPDATE policy to valid client lifecycle statuses
DROP POLICY IF EXISTS "update_own_interview_sessions" ON public.interview_sessions;
CREATE POLICY "update_own_interview_sessions"
  ON public.interview_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('created', 'active', 'abandoned', 'error')
  );

-- 3. Remove client DELETE policy to prevent deletion of records required for retention & auditing
DROP POLICY IF EXISTS "delete_own_interview_sessions" ON public.interview_sessions;

-- 4. Add trigger enforcing that clients cannot modify audit fields, results, scores, or completion status
CREATE OR REPLACE FUNCTION public.check_interview_session_client_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Service role and administrative functions have full trusted access
  IF current_user = 'service_role' OR (SELECT current_setting('request.jwt.claim.role', true)) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Protect scoring & result fields
  IF NEW.result IS DISTINCT FROM OLD.result THEN
    RAISE EXCEPTION 'Clients cannot modify interview result directly.';
  END IF;
  IF NEW.score IS DISTINCT FROM OLD.score THEN
    RAISE EXCEPTION 'Clients cannot modify interview score directly.';
  END IF;
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Clients cannot directly transition session status to completed; worker finalization required.';
  END IF;
  IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    RAISE EXCEPTION 'Clients cannot modify completed_at timestamp.';
  END IF;

  -- Protect all faculty audit & score override fields
  IF NEW.original_ai_score IS DISTINCT FROM OLD.original_ai_score THEN
    RAISE EXCEPTION 'Clients cannot modify original_ai_score.';
  END IF;
  IF NEW.score_override_reason IS DISTINCT FROM OLD.score_override_reason THEN
    RAISE EXCEPTION 'Clients cannot modify score_override_reason.';
  END IF;
  IF NEW.score_overridden_by IS DISTINCT FROM OLD.score_overridden_by THEN
    RAISE EXCEPTION 'Clients cannot modify score_overridden_by.';
  END IF;
  IF NEW.score_overridden_by_name IS DISTINCT FROM OLD.score_overridden_by_name THEN
    RAISE EXCEPTION 'Clients cannot modify score_overridden_by_name.';
  END IF;
  IF NEW.score_overridden_at IS DISTINCT FROM OLD.score_overridden_at THEN
    RAISE EXCEPTION 'Clients cannot modify score_overridden_at.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_interview_session_result ON public.interview_sessions;
CREATE TRIGGER trg_protect_interview_session_result
  BEFORE UPDATE ON public.interview_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_interview_session_client_update();
