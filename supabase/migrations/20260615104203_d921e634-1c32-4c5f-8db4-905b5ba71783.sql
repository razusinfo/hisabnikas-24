
ALTER TABLE public.sms_logs
  ADD COLUMN IF NOT EXISTS provider_msg_id text,
  ADD COLUMN IF NOT EXISTS provider_response text;

CREATE OR REPLACE FUNCTION public.consume_sms_credit(_customer_id uuid, _phone text, _body text, _kind text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  credits int;
  log_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _phone IS NULL OR length(trim(_phone)) = 0 THEN RAISE EXCEPTION 'Phone required'; END IF;
  IF _body IS NULL OR length(trim(_body)) = 0 THEN RAISE EXCEPTION 'Message required'; END IF;
  IF _kind IS NULL OR _kind NOT IN ('due_reminder','sale_receipt','payment_receipt') THEN
    RAISE EXCEPTION 'Invalid SMS kind';
  END IF;

  SELECT COALESCE(message_credits, 0) INTO credits FROM public.profiles WHERE id = uid FOR UPDATE;
  IF credits IS NULL OR credits < 1 THEN
    RAISE EXCEPTION 'পর্যাপ্ত মেসেজ ক্রেডিট নেই';
  END IF;

  UPDATE public.profiles SET message_credits = credits - 1 WHERE id = uid;

  INSERT INTO public.sms_logs (owner_id, customer_id, phone, body, status, kind)
  VALUES (uid, _customer_id, _phone, _body, 'queued', _kind)
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_sms_credit(uuid, text, text, text) TO authenticated;
