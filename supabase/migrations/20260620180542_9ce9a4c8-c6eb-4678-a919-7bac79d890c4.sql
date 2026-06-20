
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- profiles columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_device_secret_hash text,
  ADD COLUMN IF NOT EXISTS sms_auto_post boolean NOT NULL DEFAULT true;

-- inbox table
CREATE TABLE public.mfs_sms_inbox (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_body text NOT NULL,
  sender text,
  received_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL DEFAULT 'unknown' CHECK (provider IN ('bkash','nagad','rocket','upay','unknown')),
  txn_id text,
  amount numeric(14,2),
  sender_msisdn text,
  account_number text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','ignored','duplicate','error')),
  cashbook_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX mfs_sms_inbox_owner_txn_uniq
  ON public.mfs_sms_inbox(owner_id, txn_id)
  WHERE txn_id IS NOT NULL;

CREATE INDEX mfs_sms_inbox_owner_received ON public.mfs_sms_inbox(owner_id, received_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.mfs_sms_inbox TO authenticated;
GRANT ALL ON public.mfs_sms_inbox TO service_role;

ALTER TABLE public.mfs_sms_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner read sms" ON public.mfs_sms_inbox
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner update sms" ON public.mfs_sms_inbox
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner delete sms" ON public.mfs_sms_inbox
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER set_mfs_sms_inbox_updated_at
BEFORE UPDATE ON public.mfs_sms_inbox
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Generate a new device secret for the current user. Returns the plaintext once.
CREATE OR REPLACE FUNCTION public.generate_sms_device_secret()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  token text;
  hashed text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  token := encode(gen_random_bytes(24), 'hex'); -- 48 hex chars
  hashed := encode(digest(token, 'sha256'), 'hex');
  UPDATE public.profiles SET sms_device_secret_hash = hashed WHERE id = uid;
  RETURN token;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_sms_device_secret() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_sms_device_secret() TO authenticated;

-- Toggle / set auto-post
CREATE OR REPLACE FUNCTION public.set_sms_auto_post(_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.profiles SET sms_auto_post = COALESCE(_enabled, true) WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.set_sms_auto_post(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_sms_auto_post(boolean) TO authenticated;
