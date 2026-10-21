-- Migration: scope_discovered_jobs_to_student
-- Adds student_id FK to discovered_jobs for per-student job matching and scoping

ALTER TABLE public.discovered_jobs
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_discovered_jobs_student_id
  ON public.discovered_jobs(student_id);

-- Update RLS policies to allow students to read both published platform jobs and student-matched jobs
DROP POLICY IF EXISTS "Authenticated users can read discovered jobs" ON public.discovered_jobs;
CREATE POLICY "Authenticated users can read discovered jobs"
  ON public.discovered_jobs FOR SELECT
  TO authenticated
  USING (
    (publication_status = 'published' AND (student_id = auth.uid() OR student_id IS NULL))
    OR public.is_msot_admin()
  );

DROP POLICY IF EXISTS "Students can manage own discovered jobs" ON public.discovered_jobs;
CREATE POLICY "Students can manage own discovered jobs"
  ON public.discovered_jobs FOR ALL
  TO authenticated
  USING (student_id = auth.uid() OR public.is_msot_admin())
  WITH CHECK (student_id = auth.uid() OR public.is_msot_admin());

NOTIFY pgrst, 'reload schema';
