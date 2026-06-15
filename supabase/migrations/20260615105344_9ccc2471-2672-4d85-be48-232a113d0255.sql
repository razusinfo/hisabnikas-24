
-- Revoke anon execute on SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.consume_sms_credit(uuid, text, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_sms_credit(uuid, text, text, text) TO authenticated;

-- Lock subscriptions: remove user-level INSERT/UPDATE; only SECURITY DEFINER funcs (activate_plan/approve_payment_request) may write
DROP POLICY IF EXISTS "Users self-insert free subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users self-update only free" ON public.subscriptions;

-- Harden approve_payment_request: always recompute amount/duration/messages from get_plan_spec (do not trust stored row values)
CREATE OR REPLACE FUNCTION public.approve_payment_request(_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); req record; spec record;
BEGIN
  IF uid IS NULL OR NOT public.is_super_admin(uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO req FROM public.payment_requests WHERE id = _request_id;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  -- Re-derive trusted spec from plan code; ignore any user-supplied numbers on req
  SELECT * INTO spec FROM public.get_plan_spec(req.kind, req.plan);
  IF spec IS NULL OR spec.amount IS NULL THEN
    RAISE EXCEPTION 'Unknown plan code: %', req.plan;
  END IF;

  -- Normalize the stored row to authoritative spec values for auditability
  UPDATE public.payment_requests
    SET amount = spec.amount,
        duration_days = spec.duration_days,
        messages_count = spec.messages_count
    WHERE id = _request_id;

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
$function$;
