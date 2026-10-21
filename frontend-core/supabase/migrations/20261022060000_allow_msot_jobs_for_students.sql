-- Migration: allow_msot_jobs_for_students
-- Updates discovered_jobs RLS policy to ensure students can read:
-- 1) Their personalized matched jobs (student_id = auth.uid())
-- 2) Platform discovered global jobs (student_id IS NULL)
-- 3) Official MSOT staff postings (is_msot_post = true)

DROP POLICY IF EXISTS "Authenticated users can read discovered jobs" ON public.discovered_jobs;
CREATE POLICY "Authenticated users can read discovered jobs"
  ON public.discovered_jobs FOR SELECT
  TO authenticated
  USING (
    (publication_status = 'published' AND (student_id = auth.uid() OR student_id IS NULL OR is_msot_post = true))
    OR public.is_msot_admin()
  );

NOTIFY pgrst, 'reload schema';
