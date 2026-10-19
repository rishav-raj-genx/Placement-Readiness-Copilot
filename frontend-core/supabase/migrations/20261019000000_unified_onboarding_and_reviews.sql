-- Unified candidate onboarding and cached profile-review results.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS target_role text,
  ADD COLUMN IF NOT EXISTS target_locations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS projects jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS co_curricular jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_projects_array_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_projects_array_check
      CHECK (jsonb_typeof(projects) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_co_curricular_object_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_co_curricular_object_check
      CHECK (co_curricular IS NULL OR jsonb_typeof(co_curricular) = 'object');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.candidate_profile_reviews (
  student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.candidate_profile_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can read own profile review" ON public.candidate_profile_reviews;
CREATE POLICY "Students can read own profile review"
  ON public.candidate_profile_reviews FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Service role manages profile reviews" ON public.candidate_profile_reviews;
CREATE POLICY "Service role manages profile reviews"
  ON public.candidate_profile_reviews FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_candidate_profile_reviews_status
  ON public.candidate_profile_reviews(status, updated_at DESC);

NOTIFY pgrst, 'reload schema';
