
-- Add message credits to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS message_credits INTEGER NOT NULL DEFAULT 0;

-- Extend payment_requests to support message purchases
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'subscription';
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS messages_count INTEGER;
ALTER TABLE public.payment_requests DROP CONSTRAINT IF EXISTS payment_requests_kind_check;
ALTER TABLE public.payment_requests ADD CONSTRAINT payment_requests_kind_check CHECK (kind IN ('subscription','messages'));

-- Allow plan to be NULL for message purchases
ALTER TABLE public.payment_requests ALTER COLUMN plan DROP NOT NULL;
ALTER TABLE public.payment_requests ALTER COLUMN duration_days DROP NOT NULL;

-- Update approve function to branch on kind
CREATE OR REPLACE FUNCTION public.approve_payment_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); req record;
BEGIN
  IF uid IS NULL OR NOT public.is_super_admin(uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO req FROM public.payment_requests WHERE id = _request_id;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  IF req.kind = 'messages' THEN
    UPDATE public.profiles
      SET message_credits = COALESCE(message_credits, 0) + COALESCE(req.messages_count, 0)
      WHERE id = req.user_id;
  ELSE
    INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at)
    VALUES (req.user_id, req.plan, 'active', now(), now() + (req.duration_days || ' days')::interval)
    ON CONFLICT (user_id) DO UPDATE
    SET plan = EXCLUDED.plan, status = 'active', started_at = now(), expires_at = EXCLUDED.expires_at;
  END IF;

  UPDATE public.payment_requests SET status = 'approved', processed_by = uid, processed_at = now()
    WHERE id = _request_id;
END; $function$;
