CREATE OR REPLACE FUNCTION public.refund_sms_credit(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  UPDATE public.profiles
    SET message_credits = COALESCE(message_credits, 0) + 1
    WHERE id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_sms_credit(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_sms_credit(uuid) TO service_role;