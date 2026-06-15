
-- 1. Revoke execute on activate_plan from authenticated
REVOKE EXECUTE ON FUNCTION public.activate_plan(text) FROM authenticated, anon, public;

-- 2. Restrict profiles: prevent self-update of message_credits and is_super_admin
DROP POLICY IF EXISTS "own profile" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND message_credits IS NOT DISTINCT FROM (SELECT message_credits FROM public.profiles WHERE id = auth.uid())
    AND is_super_admin IS NOT DISTINCT FROM (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = id);

-- Defense-in-depth: revoke column-level update privilege
REVOKE UPDATE (message_credits, is_super_admin) ON public.profiles FROM authenticated, anon, public;

-- 3. Tighten subscriptions policy to authenticated only
DROP POLICY IF EXISTS "Users manage own subscription" ON public.subscriptions;
CREATE POLICY "Users manage own subscription" ON public.subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
