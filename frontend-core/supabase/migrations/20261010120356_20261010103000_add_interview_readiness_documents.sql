/*
# Add interview readiness profile fields and private document storage

1. Profile fields
- Add `github_username` for the user's GitHub identifier.
- Add `linkedin_url` for the user's LinkedIn profile address.
- Add `resume_pdf_path` for the private resume PDF object path.
- Add `linkedin_pdf_path` for the private LinkedIn PDF object path.

2. Storage
- Create the private `candidate-documents` bucket.
- Restrict uploads to PDF files with a 10 MB size limit.
- Store each user's documents under a folder named with their authenticated user ID.

3. Security
- Keep the bucket private.
- Add separate owner-scoped SELECT, INSERT, UPDATE, and DELETE policies for storage objects.
- Profile fields remain readable and writable only by the owning authenticated user through the existing profile policies.

4. Important notes
- Existing profile data is preserved; all new profile fields are nullable until the user completes setup.
- The browser will store only object paths in the profile record; PDF contents remain in private storage.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS github_username text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS resume_pdf_path text,
  ADD COLUMN IF NOT EXISTS linkedin_pdf_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candidate-documents',
  'candidate-documents',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf']::text[];

DROP POLICY IF EXISTS "candidate_documents_select_own" ON storage.objects;
CREATE POLICY "candidate_documents_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'candidate-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "candidate_documents_insert_own" ON storage.objects;
CREATE POLICY "candidate_documents_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'candidate-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) = 'pdf'
  );

DROP POLICY IF EXISTS "candidate_documents_update_own" ON storage.objects;
CREATE POLICY "candidate_documents_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'candidate-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'candidate-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) = 'pdf'
  );

DROP POLICY IF EXISTS "candidate_documents_delete_own" ON storage.objects;
CREATE POLICY "candidate_documents_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'candidate-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );