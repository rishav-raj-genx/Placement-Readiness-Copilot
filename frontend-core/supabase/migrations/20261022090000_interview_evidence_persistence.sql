-- Persist authoritative interview evidence outside the aggregate result payload.

ALTER TABLE public.interview_sessions
  ADD COLUMN IF NOT EXISTS transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS code_history text,
  ADD COLUMN IF NOT EXISTS viva_scores jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Replace the earlier trigger before backfilling. The previous implementation
-- referenced a nonexistent `score` column and could block this migration.
CREATE OR REPLACE FUNCTION public.check_interview_session_client_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin')
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.result IS DISTINCT FROM OLD.result
     OR NEW.transcript IS DISTINCT FROM OLD.transcript
     OR NEW.code_history IS DISTINCT FROM OLD.code_history
     OR NEW.viva_scores IS DISTINCT FROM OLD.viva_scores THEN
    RAISE EXCEPTION 'Clients cannot modify interview evidence directly.';
  END IF;

  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Only the interview backend may complete a session.';
  END IF;

  IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    RAISE EXCEPTION 'Clients cannot modify completed_at directly.';
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.interview_sessions
SET
  transcript = CASE
    WHEN jsonb_typeof(result->'transcript') = 'array' THEN result->'transcript'
    ELSE transcript
  END,
  viva_scores = CASE
    WHEN result IS NOT NULL THEN jsonb_strip_nulls(jsonb_build_object(
      'interview_score', result->'interview_score',
      'dimensions', result->'dimensions',
      'summary', result->'summary',
      'strengths', result->'strengths',
      'improvement_areas', result->'improvement_areas'
    ))
    ELSE viva_scores
  END
WHERE result IS NOT NULL;

ALTER TABLE public.interview_sessions
  DROP CONSTRAINT IF EXISTS interview_sessions_transcript_array_check,
  DROP CONSTRAINT IF EXISTS interview_sessions_viva_scores_object_check,
  DROP CONSTRAINT IF EXISTS interview_sessions_status_check;

UPDATE public.interview_sessions
SET status = 'in_progress'
WHERE status = 'active';

UPDATE public.interview_sessions
SET status = 'error'
WHERE status IN ('failed', 'cancelled');

ALTER TABLE public.interview_sessions
  ADD CONSTRAINT interview_sessions_transcript_array_check
    CHECK (jsonb_typeof(transcript) = 'array'),
  ADD CONSTRAINT interview_sessions_viva_scores_object_check
    CHECK (jsonb_typeof(viva_scores) = 'object'),
  ADD CONSTRAINT interview_sessions_status_check
    CHECK (status IN ('created', 'in_progress', 'completed', 'abandoned', 'error'));

DROP POLICY IF EXISTS "update_own_interview_sessions" ON public.interview_sessions;
CREATE POLICY "update_own_interview_sessions"
  ON public.interview_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('created', 'in_progress', 'completed', 'abandoned', 'error')
  );

NOTIFY pgrst, 'reload schema';
