-- Migration: 20261022120000_allow_docx_storage_and_linkedin_url.sql
-- Description: Updates candidate-documents storage bucket to accept DOCX in addition to PDF,
--              updates storage RLS insert policy, and guarantees profiles.linkedin_url exists.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]::text[]
WHERE id = 'candidate-documents';

DROP POLICY IF EXISTS "candidate_documents_insert_own" ON storage.objects;
CREATE POLICY "candidate_documents_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'candidate-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('pdf', 'docx')
  );

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linkedin_url text;
