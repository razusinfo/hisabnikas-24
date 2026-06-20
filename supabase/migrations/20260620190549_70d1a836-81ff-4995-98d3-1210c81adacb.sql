CREATE TABLE IF NOT EXISTS public.payment_reconciliation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  sms_inbox_id uuid REFERENCES public.mfs_sms_inbox(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  provider text,
  txn_id text,
  expected_amount numeric(14,2),
  received_amount numeric(14,2) NOT NULL,
  difference numeric(14,2) GENERATED ALWAYS AS (COALESCE(received_amount,0) - COALESCE(expected_amount,0)) STORED,
  status text NOT NULL DEFAULT 'matched',
  confidence int,
  match_reason text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_reconciliation TO authenticated;
GRANT ALL ON public.payment_reconciliation TO service_role;

ALTER TABLE public.payment_reconciliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own reconciliation"
  ON public.payment_reconciliation
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_payment_reconciliation_touch
  BEFORE UPDATE ON public.payment_reconciliation
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_owner ON public.payment_reconciliation(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_sale ON public.payment_reconciliation(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_sms ON public.payment_reconciliation(sms_inbox_id);

CREATE INDEX IF NOT EXISTS idx_mfs_sms_inbox_owner_status ON public.mfs_sms_inbox(owner_id, status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_mfs_sms_inbox_amount ON public.mfs_sms_inbox(owner_id, amount);
CREATE INDEX IF NOT EXISTS idx_mfs_sms_inbox_provider ON public.mfs_sms_inbox(owner_id, provider, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_mfs_sms_inbox_txn ON public.mfs_sms_inbox(owner_id, txn_id);

-- Manual match helper: link an SMS to a sale, settle invoice, write reconciliation.
CREATE OR REPLACE FUNCTION public.manual_match_mfs_sms(_sms_id uuid, _sale_id uuid, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  sms_row record;
  sale_row record;
  apply_amount numeric;
  new_paid numeric;
  new_due numeric;
  new_status text;
  provider_label text;
  cb_id uuid;
  recon_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO sms_row FROM public.mfs_sms_inbox WHERE id = _sms_id AND owner_id = uid;
  IF sms_row.id IS NULL THEN RAISE EXCEPTION 'SMS not found'; END IF;
  IF sms_row.amount IS NULL OR sms_row.amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  SELECT * INTO sale_row FROM public.sales WHERE id = _sale_id AND owner_id = uid;
  IF sale_row.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  apply_amount := LEAST(sms_row.amount, GREATEST(COALESCE(sale_row.due,0), sms_row.amount));
  new_paid := COALESCE(sale_row.paid,0) + sms_row.amount;
  new_due  := GREATEST(COALESCE(sale_row.due,0) - sms_row.amount, 0);
  new_status := CASE WHEN new_due <= 0.0001 THEN 'paid' ELSE 'partial' END;

  provider_label := CASE sms_row.provider
    WHEN 'bkash' THEN 'bKash'
    WHEN 'nagad' THEN 'Nagad'
    WHEN 'rocket' THEN 'Rocket'
    WHEN 'upay' THEN 'Upay'
    ELSE 'Mobile Banking'
  END;

  UPDATE public.sales
    SET paid = new_paid,
        due = new_due,
        status = new_status,
        payment_method = provider_label
    WHERE id = sale_row.id;

  IF sale_row.customer_id IS NOT NULL THEN
    UPDATE public.customers
      SET due_balance = GREATEST(COALESCE(due_balance,0) - sms_row.amount, 0)
      WHERE id = sale_row.customer_id;
  END IF;

  IF sms_row.cashbook_id IS NULL THEN
    INSERT INTO public.cashbook (owner_id, branch_id, entry_date, type, category, description, amount, method, note)
    VALUES (
      uid, sms_row.branch_id, sms_row.received_at::date, 'income', 'Mobile Banking',
      'SMS Payment: Invoice ' || sale_row.invoice_no || COALESCE(' from ' || sms_row.sender_msisdn, ''),
      sms_row.amount, provider_label,
      CASE WHEN sms_row.txn_id IS NOT NULL THEN 'TrxID ' || sms_row.txn_id ELSE NULL END
    )
    RETURNING id INTO cb_id;
  ELSE
    cb_id := sms_row.cashbook_id;
  END IF;

  UPDATE public.mfs_sms_inbox
    SET status = 'posted', matched_sale_id = sale_row.id, cashbook_id = cb_id
    WHERE id = sms_row.id;

  INSERT INTO public.payment_reconciliation
    (owner_id, branch_id, sms_inbox_id, sale_id, provider, txn_id,
     expected_amount, received_amount, status, confidence, match_reason, note, created_by)
  VALUES
    (uid, sms_row.branch_id, sms_row.id, sale_row.id, sms_row.provider, sms_row.txn_id,
     sale_row.total, sms_row.amount, new_status, 100, 'manual', _note, uid)
  RETURNING id INTO recon_id;

  RETURN recon_id;
END $$;

GRANT EXECUTE ON FUNCTION public.manual_match_mfs_sms(uuid, uuid, text) TO authenticated;

-- Ignore (dismiss) an SMS row from the unmatched queue without posting.
CREATE OR REPLACE FUNCTION public.dismiss_mfs_sms(_sms_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.mfs_sms_inbox
    SET status = 'ignored',
        error = COALESCE(_reason, error)
    WHERE id = _sms_id AND owner_id = uid;
END $$;

GRANT EXECUTE ON FUNCTION public.dismiss_mfs_sms(uuid, text) TO authenticated;