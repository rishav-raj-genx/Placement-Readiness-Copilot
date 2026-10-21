-- Atomically consume interview credits and prevent client-side entitlement tampering.

UPDATE public.profiles
SET interview_credits = 3
WHERE interview_credits IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN interview_credits SET DEFAULT 3,
  ALTER COLUMN interview_credits SET NOT NULL,
  ALTER COLUMN is_premium SET DEFAULT false,
  ALTER COLUMN is_premium SET NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_interview_credits_nonnegative;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_interview_credits_nonnegative
  CHECK (interview_credits >= 0);

CREATE OR REPLACE FUNCTION public.protect_profile_entitlements()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role'
    AND (
      NEW.interview_credits IS DISTINCT FROM OLD.interview_credits
      OR NEW.is_premium IS DISTINCT FROM OLD.is_premium
    )
  THEN
    RAISE EXCEPTION 'Interview entitlements may only be changed by the service role'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_entitlements ON public.profiles;
CREATE TRIGGER trg_protect_profile_entitlements
  BEFORE UPDATE OF interview_credits, is_premium ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_entitlements();

ALTER TABLE public.interview_sessions
  ADD COLUMN IF NOT EXISTS credit_consumed_at timestamptz;

DROP FUNCTION IF EXISTS public.consume_interview_credit(uuid);

CREATE OR REPLACE FUNCTION public.consume_interview_credit(
  p_user_id uuid,
  p_interview_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_credits integer;
  consumed_at timestamptz;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  SELECT credit_consumed_at
  INTO consumed_at
  FROM public.interview_sessions
  WHERE id = p_interview_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interview session not found' USING ERRCODE = 'P0002';
  END IF;

  IF consumed_at IS NOT NULL THEN
    SELECT interview_credits
    INTO remaining_credits
    FROM public.profiles
    WHERE id = p_user_id;

    RETURN remaining_credits;
  END IF;

  UPDATE public.profiles
  SET interview_credits = interview_credits - 1
  WHERE id = p_user_id
    AND is_premium = false
    AND interview_credits > 0
  RETURNING interview_credits INTO remaining_credits;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No interview credits available' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.interview_sessions
  SET credit_consumed_at = now()
  WHERE id = p_interview_id;

  RETURN remaining_credits;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_interview_credit(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_interview_credit(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.consume_interview_credit(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_interview_credit(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
