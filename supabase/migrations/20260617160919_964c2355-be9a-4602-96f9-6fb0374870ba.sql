
CREATE TABLE public.cashbook (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  category TEXT,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'cash',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashbook TO authenticated;
GRANT ALL ON public.cashbook TO service_role;

ALTER TABLE public.cashbook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cashbook"
  ON public.cashbook FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER cashbook_touch_updated_at
  BEFORE UPDATE ON public.cashbook
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX cashbook_owner_date_idx ON public.cashbook(owner_id, entry_date DESC);
