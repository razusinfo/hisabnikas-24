
-- Finding #1: Prevent client-side subscription plan bypass
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;

-- SECURITY DEFINER function: allow self-activating ONLY the free plan from the client.
-- Paid plans (pro/business) must be set server-side after payment verification using service_role.
CREATE OR REPLACE FUNCTION public.activate_free_plan()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at)
  VALUES (uid, 'free', 'active', now(), NULL)
  ON CONFLICT (user_id) DO UPDATE
  SET plan = 'free',
      status = 'active',
      started_at = now(),
      expires_at = NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_free_plan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_free_plan() TO authenticated;

-- Finding #4: Remove permissive public read on product-images bucket; restrict to owner via folder prefix.
DROP POLICY IF EXISTS "Public can read product images" ON storage.objects;

CREATE POLICY "Owners can read their product images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
