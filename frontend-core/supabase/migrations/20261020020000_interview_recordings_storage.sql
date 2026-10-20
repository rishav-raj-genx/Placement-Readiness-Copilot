-- Public browser-recorded interview audio with owner-scoped writes.

ALTER TABLE public.interview_sessions
  ADD COLUMN IF NOT EXISTS audio_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'interview_recordings',
  'interview_recordings',
  true,
  104857600,
  ARRAY['audio/webm']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 104857600,
    allowed_mime_types = ARRAY['audio/webm']::text[];

DROP POLICY IF EXISTS "interview_recordings_select_own_or_admin" ON storage.objects;
CREATE POLICY "interview_recordings_select_own_or_admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'interview_recordings'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_msot_admin()
    )
  );

DROP POLICY IF EXISTS "interview_recordings_insert_own" ON storage.objects;
CREATE POLICY "interview_recordings_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'interview_recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) = 'webm'
  );

DROP POLICY IF EXISTS "interview_recordings_update_own" ON storage.objects;
CREATE POLICY "interview_recordings_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'interview_recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'interview_recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) = 'webm'
  );

DROP POLICY IF EXISTS "interview_recordings_delete_own" ON storage.objects;
CREATE POLICY "interview_recordings_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'interview_recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
