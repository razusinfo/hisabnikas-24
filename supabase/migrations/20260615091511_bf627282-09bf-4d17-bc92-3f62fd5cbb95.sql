-- Remove 'trial' from self-insert/update RLS on subscriptions
DROP POLICY IF EXISTS "Users self-insert free subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users self-update only free" ON public.subscriptions;

CREATE POLICY "Users self-insert free subscription"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND plan = 'free');

CREATE POLICY "Users self-update only free"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND plan = 'free')
  WITH CHECK (auth.uid() = user_id AND plan = 'free');