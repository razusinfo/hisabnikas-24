
-- 1) Strengthen purchase_items policy: require owner_id = auth.uid() in addition to purchase ownership join
DROP POLICY IF EXISTS "own purchase_items" ON public.purchase_items;
CREATE POLICY "own purchase_items" ON public.purchase_items
FOR ALL
USING (
  owner_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = purchase_items.purchase_id AND p.owner_id = auth.uid())
)
WITH CHECK (
  owner_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = purchase_items.purchase_id AND p.owner_id = auth.uid())
);

-- 2) Explicitly block authenticated users from inserting/updating/deleting user_roles.
-- RLS is already enabled and no write policies exist (fail-closed), but add explicit deny policies
-- for defense-in-depth and auditability. Only service_role bypasses RLS.
DROP POLICY IF EXISTS "deny insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "deny update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "deny delete user_roles" ON public.user_roles;

CREATE POLICY "deny insert user_roles" ON public.user_roles
FOR INSERT TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "deny update user_roles" ON public.user_roles
FOR UPDATE TO authenticated, anon
USING (false)
WITH CHECK (false);

CREATE POLICY "deny delete user_roles" ON public.user_roles
FOR DELETE TO authenticated, anon
USING (false);
