
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = _uid AND is_super_admin = true)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'company_name');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at)
  VALUES (NEW.id, 'trial', 'active', now(), now() + interval '10 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL,
  duration_days integer NOT NULL,
  amount numeric NOT NULL,
  bkash_number text NOT NULL,
  sender_number text NOT NULL,
  trx_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  note text,
  processed_by uuid REFERENCES auth.users(id),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own or super admin" ON public.payment_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE POLICY "create own pending" ON public.payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "super admin updates" ON public.payment_requests
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER tr_payment_requests_updated_at
BEFORE UPDATE ON public.payment_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.approve_payment_request(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); req record;
BEGIN
  IF uid IS NULL OR NOT public.is_super_admin(uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO req FROM public.payment_requests WHERE id = _request_id;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at)
  VALUES (req.user_id, req.plan, 'active', now(), now() + (req.duration_days || ' days')::interval)
  ON CONFLICT (user_id) DO UPDATE
  SET plan = EXCLUDED.plan, status = 'active', started_at = now(), expires_at = EXCLUDED.expires_at;

  UPDATE public.payment_requests SET status = 'approved', processed_by = uid, processed_at = now()
    WHERE id = _request_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_payment_request(_request_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.is_super_admin(uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.payment_requests
    SET status = 'rejected', note = _note, processed_by = uid, processed_at = now()
    WHERE id = _request_id AND status = 'pending';
END; $$;
