-- Migration: 20261022130000_add_linkedin_text_to_profiles.sql
-- Description: Adds linkedin_text column to profiles table and reloads schema cache.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linkedin_text TEXT;

NOTIFY pgrst, 'reload schema';
