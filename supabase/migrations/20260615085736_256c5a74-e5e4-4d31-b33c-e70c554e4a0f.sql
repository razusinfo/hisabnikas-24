
CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  phone text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  kind text NOT NULL DEFAULT 'due_reminder',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sms_logs_owner ON public.sms_logs(owner_id, created_at DESC);

GRANT SELECT, INSERT ON public.sms_logs TO authenticated;
GRANT ALL ON public.sms_logs TO service_role;

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sms logs" ON public.sms_logs FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Users insert own sms logs" ON public.sms_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.send_due_reminder_sms(_customer_id uuid, _phone text, _body text)
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

  SELECT COALESCE(message_credits, 0) INTO credits FROM public.profiles WHERE id = uid FOR UPDATE;
  IF credits IS NULL OR credits < 1 THEN
    RAISE EXCEPTION 'পর্যাপ্ত মেসেজ ক্রেডিট নেই';
  END IF;

  UPDATE public.profiles SET message_credits = credits - 1 WHERE id = uid;

  INSERT INTO public.sms_logs (owner_id, customer_id, phone, body, status, kind)
  VALUES (uid, _customer_id, _phone, _body, 'sent', 'due_reminder')
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_due_reminder_sms(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_due_reminder_sms(uuid, text, text) TO authenticated;
