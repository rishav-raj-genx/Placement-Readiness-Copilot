-- ====================================================================
-- Add freemium interview credits and premium status to profiles table
-- ====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interview_credits INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;

-- Ensure default values for existing rows
UPDATE public.profiles
SET interview_credits = 3
WHERE interview_credits IS NULL;

UPDATE public.profiles
SET is_premium = FALSE
WHERE is_premium IS NULL;
