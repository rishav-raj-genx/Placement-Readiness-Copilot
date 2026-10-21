-- Store faculty overrides independently from immutable AI interview evidence.

ALTER TABLE public.interview_sessions
  ADD COLUMN IF NOT EXISTS admin_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS admin_feedback text,
  ADD COLUMN IF NOT EXISTS admin_scored_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_scored_by_name text,
  ADD COLUMN IF NOT EXISTS admin_scored_at timestamptz;

-- Migrate legacy overrides and restore the original AI score in result.
UPDATE public.interview_sessions
SET
  admin_score = COALESCE(admin_score, interview_score),
  admin_feedback = COALESCE(
    NULLIF(trim(admin_feedback), ''),
    NULLIF(trim(score_override_reason), ''),
    'Legacy faculty override'
  ),
  admin_scored_by = COALESCE(admin_scored_by, score_overridden_by),
  admin_scored_by_name = COALESCE(admin_scored_by_name, score_overridden_by_name),
  admin_scored_at = COALESCE(admin_scored_at, score_overridden_at),
  result = CASE
    WHEN original_ai_score IS NOT NULL AND result IS NOT NULL THEN
      jsonb_set(
        result,
        '{interview_score}',
        to_jsonb(original_ai_score),
        true
      )
    ELSE result
  END
WHERE score_overridden_at IS NOT NULL;

ALTER TABLE public.interview_sessions
  DROP CONSTRAINT IF EXISTS interview_sessions_admin_score_range_check,
  DROP CONSTRAINT IF EXISTS interview_sessions_admin_feedback_required_check;

ALTER TABLE public.interview_sessions
  ADD CONSTRAINT interview_sessions_admin_score_range_check
    CHECK (admin_score IS NULL OR admin_score BETWEEN 0 AND 100),
  ADD CONSTRAINT interview_sessions_admin_feedback_required_check
    CHECK (
      admin_score IS NULL
      OR length(trim(COALESCE(admin_feedback, ''))) > 0
    );

CREATE OR REPLACE FUNCTION public.check_interview_session_client_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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
    RAISE EXCEPTION 'Clients cannot modify interview evidence directly.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.admin_score IS DISTINCT FROM OLD.admin_score
     OR NEW.admin_feedback IS DISTINCT FROM OLD.admin_feedback
     OR NEW.admin_scored_by IS DISTINCT FROM OLD.admin_scored_by
     OR NEW.admin_scored_by_name IS DISTINCT FROM OLD.admin_scored_by_name
     OR NEW.admin_scored_at IS DISTINCT FROM OLD.admin_scored_at
     OR NEW.original_ai_score IS DISTINCT FROM OLD.original_ai_score
     OR NEW.score_override_reason IS DISTINCT FROM OLD.score_override_reason
     OR NEW.score_overridden_by IS DISTINCT FROM OLD.score_overridden_by
     OR NEW.score_overridden_by_name IS DISTINCT FROM OLD.score_overridden_by_name
     OR NEW.score_overridden_at IS DISTINCT FROM OLD.score_overridden_at THEN
    RAISE EXCEPTION 'Clients cannot modify faculty audit fields directly.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Only the interview backend may complete a session.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    RAISE EXCEPTION 'Clients cannot modify completed_at directly.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.override_interview_score(
  p_interview_id text,
  p_override_score numeric,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ai_score numeric(5, 2);
  v_previous_effective_score numeric(5, 2);
  v_faculty_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_msot_admin() THEN
    RAISE EXCEPTION 'Administrative permission required' USING ERRCODE = '42501';
  END IF;

  IF p_override_score IS NULL OR p_override_score < 0 OR p_override_score > 100 THEN
    RAISE EXCEPTION 'Override score must be between 0 and 100' USING ERRCODE = '22023';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Faculty feedback is required' USING ERRCODE = '22023';
  END IF;

  SELECT
    interview_score,
    COALESCE(admin_score, interview_score)
  INTO v_ai_score, v_previous_effective_score
  FROM public.interview_sessions
  WHERE id = p_interview_id
    AND status = 'completed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Completed interview not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_ai_score IS NULL THEN
    RAISE EXCEPTION 'AI interview score not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(NULLIF(display_name, ''), NULLIF(email, ''), 'MSOT Staff')
  INTO v_faculty_name
  FROM public.profiles
  WHERE id = auth.uid();

  UPDATE public.interview_sessions
  SET
    admin_score = round(p_override_score, 2),
    admin_feedback = trim(p_reason),
    admin_scored_by = auth.uid(),
    admin_scored_by_name = COALESCE(v_faculty_name, 'MSOT Staff'),
    admin_scored_at = now(),
    original_ai_score = COALESCE(original_ai_score, v_ai_score),
    score_override_reason = trim(p_reason),
    score_overridden_by = auth.uid(),
    score_overridden_by_name = COALESCE(v_faculty_name, 'MSOT Staff'),
    score_overridden_at = now()
  WHERE id = p_interview_id;

  INSERT INTO public.interview_score_overrides (
    interview_id,
    previous_score,
    override_score,
    reason,
    faculty_id,
    faculty_name
  ) VALUES (
    p_interview_id,
    v_previous_effective_score,
    round(p_override_score, 2),
    trim(p_reason),
    auth.uid(),
    COALESCE(v_faculty_name, 'MSOT Staff')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.override_interview_score(text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.override_interview_score(text, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.override_interview_score(text, numeric, text) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_interview_sessions_admin_scored_at
  ON public.interview_sessions(admin_scored_at DESC)
  WHERE admin_score IS NOT NULL;

NOTIFY pgrst, 'reload schema';
