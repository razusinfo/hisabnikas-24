
CREATE OR REPLACE FUNCTION public.get_plan_spec(_kind text, _plan text)
RETURNS TABLE(amount numeric, duration_days integer, messages_count integer)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT t.amount, t.duration_days, t.messages_count
  FROM (VALUES
    ('subscription','basic_30',  399::numeric,  30::int,  NULL::int),
    ('subscription','pro_30',    699::numeric,  30::int,  NULL::int),
    ('subscription','basic_365', 1499::numeric, 365::int, NULL::int),
    ('subscription','pro_365',   1999::numeric, 365::int, NULL::int),
    ('messages','msg_100',  50::numeric,   NULL::int, 100::int),
    ('messages','msg_500',  225::numeric,  NULL::int, 500::int),
    ('messages','msg_1000', 400::numeric,  NULL::int, 1000::int),
    ('messages','msg_5000', 1750::numeric, NULL::int, 5000::int)
  ) AS t(kind, plan, amount, duration_days, messages_count)
  WHERE t.kind = _kind AND t.plan = _plan;
$$;

CREATE OR REPLACE FUNCTION public.validate_payment_request()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE spec record;
BEGIN
  IF NEW.kind NOT IN ('subscription','messages') THEN
    RAISE EXCEPTION 'Invalid request kind';
  END IF;
  SELECT * INTO spec FROM public.get_plan_spec(NEW.kind, NEW.plan);
  IF spec IS NULL OR spec.amount IS NULL THEN
    RAISE EXCEPTION 'Unknown plan code: %', NEW.plan;
  END IF;
  NEW.amount := spec.amount;
  NEW.duration_days := spec.duration_days;
  NEW.messages_count := spec.messages_count;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment_request ON public.payment_requests;
CREATE TRIGGER trg_validate_payment_request
BEFORE INSERT ON public.payment_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_request();

CREATE OR REPLACE FUNCTION public.approve_payment_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); req record; spec record;
BEGIN
  IF uid IS NULL OR NOT public.is_super_admin(uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO req FROM public.payment_requests WHERE id = _request_id;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  SELECT * INTO spec FROM public.get_plan_spec(req.kind, req.plan);
  IF spec IS NULL OR spec.amount IS NULL THEN
    RAISE EXCEPTION 'Unknown plan code: %', req.plan;
  END IF;

  IF req.kind = 'messages' THEN
    UPDATE public.profiles
      SET message_credits = COALESCE(message_credits, 0) + spec.messages_count
      WHERE id = req.user_id;
  ELSE
    INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at)
    VALUES (req.user_id, req.plan, 'active', now(), now() + (spec.duration_days || ' days')::interval)
    ON CONFLICT (user_id) DO UPDATE
    SET plan = EXCLUDED.plan, status = 'active', started_at = now(), expires_at = EXCLUDED.expires_at;
  END IF;

  UPDATE public.payment_requests SET status = 'approved', processed_by = uid, processed_at = now()
    WHERE id = _request_id;
END;
$$;

DROP POLICY IF EXISTS "Users manage own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users self-insert free subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users self-update only free" ON public.subscriptions;

CREATE POLICY "Users view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users self-insert free subscription" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND plan IN ('free','trial'));

CREATE POLICY "Users self-update only free" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND plan IN ('free','trial'))
  WITH CHECK (auth.uid() = user_id AND plan IN ('free','trial'));
