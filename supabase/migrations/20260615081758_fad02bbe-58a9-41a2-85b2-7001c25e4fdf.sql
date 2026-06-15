CREATE OR REPLACE FUNCTION public.activate_plan(_plan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  exp timestamptz;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _plan NOT IN ('free','pro','business') THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;
  IF _plan <> 'free' AND NOT public.is_super_admin(uid) THEN
    RAISE EXCEPTION 'Forbidden: paid plans require an approved payment request';
  END IF;
  IF _plan = 'free' THEN
    exp := NULL;
  ELSE
    exp := now() + interval '30 days';
  END IF;

  INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at)
  VALUES (uid, _plan, 'active', now(), exp)
  ON CONFLICT (user_id) DO UPDATE
  SET plan = EXCLUDED.plan,
      status = 'active',
      started_at = now(),
      expires_at = EXCLUDED.expires_at;
END;
$function$;
