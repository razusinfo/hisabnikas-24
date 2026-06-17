
CREATE TABLE public.cashbook_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income','expense')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, type, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashbook_categories TO authenticated;
GRANT ALL ON public.cashbook_categories TO service_role;

ALTER TABLE public.cashbook_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages own cashbook categories"
ON public.cashbook_categories FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER cashbook_categories_touch
BEFORE UPDATE ON public.cashbook_categories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_cashbook_categories_owner ON public.cashbook_categories(owner_id, type);
