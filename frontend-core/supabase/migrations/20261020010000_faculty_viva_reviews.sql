-- Faculty review access, recording metadata, and audited score overrides.

ALTER TABLE public.interview_sessions
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS original_ai_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS score_override_reason text,
  ADD COLUMN IF NOT EXISTS score_overridden_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS score_overridden_by_name text,
  ADD COLUMN IF NOT EXISTS score_overridden_at timestamptz;

CREATE TABLE IF NOT EXISTS public.interview_score_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id text NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  previous_score numeric(5, 2) NOT NULL CHECK (previous_score BETWEEN 0 AND 100),
  override_score numeric(5, 2) NOT NULL CHECK (override_score BETWEEN 0 AND 100),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  faculty_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  faculty_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_score_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "MSOT admins can read interview sessions" ON public.interview_sessions;
CREATE POLICY "MSOT admins can read interview sessions"
  ON public.interview_sessions FOR SELECT
  TO authenticated
  USING (public.is_msot_admin());

DROP POLICY IF EXISTS "MSOT admins can read score overrides" ON public.interview_score_overrides;
CREATE POLICY "MSOT admins can read score overrides"
  ON public.interview_score_overrides FOR SELECT
  TO authenticated
  USING (public.is_msot_admin());

CREATE INDEX IF NOT EXISTS idx_interview_score_overrides_interview
  ON public.interview_score_overrides(interview_id, created_at DESC);

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
  v_previous_score numeric(5, 2);
  v_faculty_name text;
BEGIN
  IF NOT public.is_msot_admin() THEN
    RAISE EXCEPTION 'Administrative permission required' USING ERRCODE = '42501';
  END IF;

  IF p_override_score IS NULL OR p_override_score < 0 OR p_override_score > 100 THEN
    RAISE EXCEPTION 'Override score must be between 0 and 100' USING ERRCODE = '22023';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason for the override is required' USING ERRCODE = '22023';
  END IF;

  SELECT interview_score
  INTO v_previous_score
  FROM public.interview_sessions
  WHERE id = p_interview_id
  FOR UPDATE;

  IF NOT FOUND OR v_previous_score IS NULL THEN
    RAISE EXCEPTION 'Interview score not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(NULLIF(display_name, ''), NULLIF(email, ''), 'MSOT Staff')
  INTO v_faculty_name
  FROM public.profiles
  WHERE id = auth.uid();

  UPDATE public.interview_sessions
  SET
    original_ai_score = COALESCE(original_ai_score, v_previous_score),
    result = jsonb_set(
      COALESCE(result, '{}'::jsonb),
      '{interview_score}',
      to_jsonb(round(p_override_score, 2)),
      true
    ),
    score_override_reason = trim(p_reason),
    score_overridden_by = auth.uid(),
    score_overridden_by_name = v_faculty_name,
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
    v_previous_score,
    round(p_override_score, 2),
    trim(p_reason),
    auth.uid(),
    v_faculty_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.override_interview_score(text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.override_interview_score(text, numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
