
-- Phase 1: Multi-branch foundation
-- 1) companies
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manage company" ON public.companies FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_companies_touch BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) branches
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  address text,
  phone text,
  is_main boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (owner_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_branches_touch BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) branch_users (which staff can access which branch)
CREATE TABLE IF NOT EXISTS public.branch_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'cashier',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_users TO authenticated;
GRANT ALL ON public.branch_users TO service_role;
ALTER TABLE public.branch_users ENABLE ROW LEVEL SECURITY;

-- 4) Security-definer helpers
CREATE OR REPLACE FUNCTION public.user_can_access_branch(_uid uuid, _branch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = _branch_id
      AND (b.owner_id = _uid
           OR EXISTS (SELECT 1 FROM public.branch_users bu WHERE bu.branch_id = b.id AND bu.user_id = _uid)
           OR public.is_super_admin(_uid))
  );
$$;

CREATE OR REPLACE FUNCTION public.user_branch_ids(_uid uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.branches WHERE owner_id = _uid AND deleted_at IS NULL
  UNION
  SELECT branch_id FROM public.branch_users WHERE user_id = _uid;
$$;

-- 5) RLS policies for branches/branch_users
CREATE POLICY "owner manage branches" ON public.branches FOR ALL
  USING (auth.uid() = owner_id OR public.is_super_admin(auth.uid()))
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "members view branches" ON public.branches FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.branch_users bu WHERE bu.branch_id = id AND bu.user_id = auth.uid()));

CREATE POLICY "owner manage branch_users" ON public.branch_users FOR ALL
  USING (auth.uid() = owner_id OR public.is_super_admin(auth.uid()))
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "self view branch_users" ON public.branch_users FOR SELECT
  USING (auth.uid() = user_id);

-- 6) Add branch_id to existing tables
ALTER TABLE public.sales         ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.purchases     ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.expenses      ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.cashbook      ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.customers     ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.products      ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.mfs_sms_inbox ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.mfs_accounts  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);

CREATE INDEX IF NOT EXISTS idx_sales_branch ON public.sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchases_branch ON public.purchases(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON public.expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_branch ON public.cashbook(branch_id);
CREATE INDEX IF NOT EXISTS idx_customers_branch ON public.customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_branch ON public.products(branch_id);

-- 7) Backfill: create a Main Branch per existing owner and populate branch_id
DO $$
DECLARE
  r record;
  bid uuid;
BEGIN
  FOR r IN SELECT DISTINCT owner_id FROM (
    SELECT owner_id FROM public.sales WHERE owner_id IS NOT NULL
    UNION SELECT owner_id FROM public.purchases WHERE owner_id IS NOT NULL
    UNION SELECT owner_id FROM public.products WHERE owner_id IS NOT NULL
    UNION SELECT owner_id FROM public.customers WHERE owner_id IS NOT NULL
    UNION SELECT owner_id FROM public.expenses WHERE owner_id IS NOT NULL
    UNION SELECT owner_id FROM public.cashbook WHERE owner_id IS NOT NULL
    UNION SELECT id AS owner_id FROM public.profiles
  ) AS o LOOP
    SELECT id INTO bid FROM public.branches WHERE owner_id = r.owner_id AND is_main = true LIMIT 1;
    IF bid IS NULL THEN
      INSERT INTO public.branches (owner_id, name, code, is_main, is_active)
      VALUES (r.owner_id, 'Main Branch', 'MAIN', true, true)
      RETURNING id INTO bid;
    END IF;
    UPDATE public.sales         SET branch_id = bid WHERE owner_id = r.owner_id AND branch_id IS NULL;
    UPDATE public.purchases     SET branch_id = bid WHERE owner_id = r.owner_id AND branch_id IS NULL;
    UPDATE public.expenses      SET branch_id = bid WHERE owner_id = r.owner_id AND branch_id IS NULL;
    UPDATE public.cashbook      SET branch_id = bid WHERE owner_id = r.owner_id AND branch_id IS NULL;
    UPDATE public.customers     SET branch_id = bid WHERE owner_id = r.owner_id AND branch_id IS NULL;
    UPDATE public.products      SET branch_id = bid WHERE owner_id = r.owner_id AND branch_id IS NULL;
    UPDATE public.mfs_sms_inbox SET branch_id = bid WHERE owner_id = r.owner_id AND branch_id IS NULL;
    UPDATE public.mfs_accounts  SET branch_id = bid WHERE owner_id = r.owner_id AND branch_id IS NULL;
  END LOOP;
END $$;

-- 8) Auto-create Main Branch for new signups
CREATE OR REPLACE FUNCTION public.create_default_branch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.branches (owner_id, name, code, is_main, is_active)
  VALUES (NEW.id, 'Main Branch', 'MAIN', true, true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profile_default_branch ON public.profiles;
CREATE TRIGGER trg_profile_default_branch
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.create_default_branch();
