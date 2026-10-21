-- Migration: Add scores JSONB column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT '{}'::jsonb;
