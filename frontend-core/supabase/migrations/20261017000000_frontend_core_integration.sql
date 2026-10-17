-- Frontend integration fields, secure profile provisioning, and MSOT Admin job management.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS leetcode_url text;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(COALESCE(NEW.email, ''), '@', 1), 'Student'),
    'student'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.prevent_client_role_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only the service role may change profile roles';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_change ON public.profiles;
CREATE TRIGGER prevent_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_client_role_change();

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'student');

ALTER TABLE public.discovered_jobs
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS required_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'discovered_jobs_employment_type_check'
  ) THEN
    ALTER TABLE public.discovered_jobs
      ADD CONSTRAINT discovered_jobs_employment_type_check
      CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'internship'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'discovered_jobs_publication_status_check'
  ) THEN
    ALTER TABLE public.discovered_jobs
      ADD CONSTRAINT discovered_jobs_publication_status_check
      CHECK (publication_status IN ('published', 'unpublished'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_msot_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_msot_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_msot_admin() TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can read discovered jobs" ON public.discovered_jobs;
CREATE POLICY "Authenticated users can read discovered jobs"
  ON public.discovered_jobs FOR SELECT
  TO authenticated
  USING (publication_status = 'published' OR public.is_msot_admin());

DROP POLICY IF EXISTS "MSOT admins can insert jobs" ON public.discovered_jobs;
CREATE POLICY "MSOT admins can insert jobs"
  ON public.discovered_jobs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_msot_admin());

DROP POLICY IF EXISTS "MSOT admins can update jobs" ON public.discovered_jobs;
CREATE POLICY "MSOT admins can update jobs"
  ON public.discovered_jobs FOR UPDATE
  TO authenticated
  USING (public.is_msot_admin())
  WITH CHECK (public.is_msot_admin());

DROP POLICY IF EXISTS "MSOT admins can delete jobs" ON public.discovered_jobs;
CREATE POLICY "MSOT admins can delete jobs"
  ON public.discovered_jobs FOR DELETE
  TO authenticated
  USING (public.is_msot_admin());

NOTIFY pgrst, 'reload schema';
