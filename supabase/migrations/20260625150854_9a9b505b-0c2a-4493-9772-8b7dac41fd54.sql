
-- 1) Fix self-join bug in branches members policy
DROP POLICY IF EXISTS "members view branches" ON public.branches;
CREATE POLICY "members view branches" ON public.branches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.branch_users bu
      WHERE bu.branch_id = branches.id
        AND bu.user_id = auth.uid()
    )
  );

-- 2) Add INSERT policy for mfs_sms_inbox owners
DROP POLICY IF EXISTS "owner insert sms" ON public.mfs_sms_inbox;
CREATE POLICY "owner insert sms" ON public.mfs_sms_inbox
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- 3) Revoke EXECUTE from anon on SECURITY DEFINER functions that require an authenticated user
REVOKE EXECUTE ON FUNCTION public.generate_sms_device_secret() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_sms_auto_post(boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_branch_ids(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_can_access_branch(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_default_branch() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dismiss_mfs_sms(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.manual_match_mfs_sms(uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.process_mfs_sms(uuid, uuid, numeric, text, text, text, timestamptz) FROM anon, public;
