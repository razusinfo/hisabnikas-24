
CREATE OR REPLACE FUNCTION public.revoke_subscription(_user_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.is_super_admin(uid) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  UPDATE public.subscriptions
    SET status = 'revoked',
        expires_at = now(),
        updated_at = now()
    WHERE user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_all_subscriptions()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  company_name text,
  phone text,
  plan text,
  status text,
  started_at timestamptz,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id, p.full_name, p.company_name, p.phone,
         s.plan, s.status, s.started_at, s.expires_at
  FROM public.subscriptions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY s.updated_at DESC NULLS LAST, s.started_at DESC;
$$;

REVOKE ALL ON FUNCTION public.revoke_subscription(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_subscription(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.list_all_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_all_subscriptions() TO authenticated;
