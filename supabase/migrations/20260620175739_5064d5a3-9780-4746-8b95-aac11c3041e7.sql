
CREATE TABLE public.mfs_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('bkash','nagad','rocket','upay')),
  account_name text NOT NULL,
  account_number text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mfs_accounts TO authenticated;
GRANT ALL ON public.mfs_accounts TO service_role;

ALTER TABLE public.mfs_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their MFS accounts"
ON public.mfs_accounts FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER set_mfs_accounts_updated_at
BEFORE UPDATE ON public.mfs_accounts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_mfs_accounts_owner ON public.mfs_accounts(owner_id, provider);
