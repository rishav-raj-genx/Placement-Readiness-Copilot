-- Base tables shared by frontend-core and the automation worker.

CREATE TABLE IF NOT EXISTS public.project_live_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  project_name text,
  project_url text NOT NULL,
  status_code integer,
  is_live boolean NOT NULL DEFAULT false,
  load_time_ms integer,
  mobile_friendly boolean DEFAULT false,
  screenshot_url text,
  console_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  network_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_evaluation jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_score numeric(5, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discovered_jobs (
  id text PRIMARY KEY,
  title text NOT NULL,
  company text NOT NULL,
  location text,
  url text NOT NULL UNIQUE,
  source text NOT NULL,
  matched_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  relevance_score numeric(5, 2) NOT NULL DEFAULT 0,
  match_reason text,
  is_remote boolean NOT NULL DEFAULT false,
  job_type text NOT NULL DEFAULT 'internship/entry-level',
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.application_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  job_id text REFERENCES public.discovered_jobs(id) ON DELETE SET NULL,
  company text NOT NULL,
  role text NOT NULL,
  url text,
  status text NOT NULL DEFAULT 'Saved' CHECK (
    status IN (
      'Saved', 'Applied', 'Shortlisted', 'Interview', 'Offer', 'Rejected',
      'saved', 'applied', 'shortlisted', 'interview', 'interviewing', 'offer', 'rejected'
    )
  ),
  applied_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, company, role)
);

CREATE TABLE IF NOT EXISTS public.readiness_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL UNIQUE,
  total_score numeric(5, 2) NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  readiness_level text NOT NULL CHECK (
    readiness_level IN ('Not ready', 'Almost ready', 'Placement ready')
  ),
  breakdown jsonb NOT NULL,
  top_actions jsonb NOT NULL,
  raw_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version text NOT NULL DEFAULT 'v1.0.0',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_checks_student
  ON public.project_live_checks(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_relevance
  ON public.discovered_jobs(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_app_tracker_student
  ON public.application_tracker(student_id, status);
CREATE INDEX IF NOT EXISTS idx_readiness_level
  ON public.readiness_scores(readiness_level);

ALTER TABLE public.project_live_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readiness_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can read own live checks" ON public.project_live_checks;
CREATE POLICY "Students can read own live checks"
  ON public.project_live_checks FOR SELECT TO authenticated
  USING (auth.uid()::text = student_id);

DROP POLICY IF EXISTS "Students can read own readiness scores" ON public.readiness_scores;
CREATE POLICY "Students can read own readiness scores"
  ON public.readiness_scores FOR SELECT TO authenticated
  USING (auth.uid()::text = student_id);

DROP POLICY IF EXISTS "Students can manage own applications" ON public.application_tracker;
CREATE POLICY "Students can manage own applications"
  ON public.application_tracker FOR ALL TO authenticated
  USING (auth.uid()::text = student_id)
  WITH CHECK (auth.uid()::text = student_id);

DROP POLICY IF EXISTS "Service role full access project_live_checks" ON public.project_live_checks;
CREATE POLICY "Service role full access project_live_checks"
  ON public.project_live_checks FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access discovered_jobs" ON public.discovered_jobs;
CREATE POLICY "Service role full access discovered_jobs"
  ON public.discovered_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access application_tracker" ON public.application_tracker;
CREATE POLICY "Service role full access application_tracker"
  ON public.application_tracker FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access readiness_scores" ON public.readiness_scores;
CREATE POLICY "Service role full access readiness_scores"
  ON public.readiness_scores FOR ALL TO service_role USING (true) WITH CHECK (true);
