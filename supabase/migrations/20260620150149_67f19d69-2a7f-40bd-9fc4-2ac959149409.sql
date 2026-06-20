CREATE OR REPLACE FUNCTION public.list_all_users()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  company_name text,
  phone text,
  email text,
  created_at timestamptz,
  plan text,
  status text,
  expires_at timestamptz,
  message_credits int,
  roles text[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.id AS user_id,
    p.full_name,
    p.company_name,
    p.phone,
    u.email::text,
    p.created_at,
    s.plan,
    s.status,
    s.expires_at,
    COALESCE(p.message_credits, 0) AS message_credits,
    COALESCE(
      (SELECT array_agg(ur.role::text ORDER BY ur.role::text) FROM public.user_roles ur WHERE ur.user_id = p.id),
      ARRAY[]::text[]
    ) AS roles
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.subscriptions s ON s.user_id = p.id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY p.created_at DESC NULLS LAST;
$function$;

GRANT EXECUTE ON FUNCTION public.list_all_users() TO authenticated;