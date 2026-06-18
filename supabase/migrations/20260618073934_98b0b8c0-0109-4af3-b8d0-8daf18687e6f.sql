
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role FROM public.profiles WHERE is_super_admin = true
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'super_admin')
$$;

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_super_admin;

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND message_credits IS NOT DISTINCT FROM (SELECT message_credits FROM public.profiles WHERE id = auth.uid())
  );

REVOKE UPDATE (message_credits) ON public.profiles FROM authenticated, anon, public;

DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
