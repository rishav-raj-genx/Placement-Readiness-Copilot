-- Official MSOT job posts and staff-only applicant visibility.

ALTER TABLE public.discovered_jobs
  ADD COLUMN IF NOT EXISTS is_msot_post boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_discovered_jobs_msot_published
  ON public.discovered_jobs(is_msot_post DESC, posted_at DESC)
  WHERE publication_status = 'published';

DROP POLICY IF EXISTS "MSOT admins can read applications" ON public.application_tracker;
CREATE POLICY "MSOT admins can read applications"
  ON public.application_tracker FOR SELECT
  TO authenticated
  USING (public.is_msot_admin());

DROP POLICY IF EXISTS "MSOT admins can read candidate profiles" ON public.profiles;
CREATE POLICY "MSOT admins can read candidate profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_msot_admin());

NOTIFY pgrst, 'reload schema';
