
ALTER TABLE public.mfs_sms_inbox
  ADD COLUMN IF NOT EXISTS matched_sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mfs_sms_matched_sale ON public.mfs_sms_inbox(matched_sale_id) WHERE matched_sale_id IS NOT NULL;

-- Atomic match + apply SMS payment to a pending invoice.
-- Returns the matched sale id (or NULL when no match found).
CREATE OR REPLACE FUNCTION public.process_mfs_sms(
  _sms_id uuid,
  _owner_id uuid,
  _amount numeric,
  _sender_msisdn text,
  _provider text,
  _txn_id text,
  _received_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cust_id uuid;
  sale_row record;
  new_paid numeric;
  new_due numeric;
  new_status text;
  provider_label text;
  cb_id uuid;
BEGIN
  IF _owner_id IS NULL OR _amount IS NULL OR _amount <= 0 THEN
    RETURN NULL;
  END IF;

  provider_label := CASE _provider
    WHEN 'bkash' THEN 'bKash'
    WHEN 'nagad' THEN 'Nagad'
    WHEN 'rocket' THEN 'Rocket'
    WHEN 'upay' THEN 'Upay'
    ELSE 'Mobile Banking'
  END;

  -- Try to map sender msisdn to a customer of this owner
  IF _sender_msisdn IS NOT NULL THEN
    SELECT id INTO cust_id
    FROM public.customers
    WHERE owner_id = _owner_id
      AND regexp_replace(COALESCE(phone, ''), '\D', '', 'g') LIKE '%' || regexp_replace(_sender_msisdn, '\D', '', 'g') || '%'
    LIMIT 1;
  END IF;

  -- Find best matching pending invoice.
  -- Priority: same customer + exact due amount, then exact amount any customer (oldest first),
  -- then same customer with due >= amount (partial), then any due >= amount.
  SELECT * INTO sale_row FROM public.sales
  WHERE owner_id = _owner_id
    AND status IN ('due','partial')
    AND due = _amount
    AND (cust_id IS NULL OR customer_id = cust_id)
  ORDER BY (customer_id = cust_id) DESC NULLS LAST, created_at ASC
  LIMIT 1;

  IF sale_row.id IS NULL THEN
    SELECT * INTO sale_row FROM public.sales
    WHERE owner_id = _owner_id
      AND status IN ('due','partial')
      AND due = _amount
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF sale_row.id IS NULL AND cust_id IS NOT NULL THEN
    SELECT * INTO sale_row FROM public.sales
    WHERE owner_id = _owner_id
      AND status IN ('due','partial')
      AND customer_id = cust_id
      AND due >= _amount
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF sale_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  new_paid := COALESCE(sale_row.paid, 0) + _amount;
  new_due  := GREATEST(COALESCE(sale_row.due, 0) - _amount, 0);
  new_status := CASE WHEN new_due <= 0.0001 THEN 'paid' ELSE 'partial' END;

  UPDATE public.sales
  SET paid = new_paid,
      due  = new_due,
      status = new_status,
      payment_method = provider_label
  WHERE id = sale_row.id;

  -- Reduce customer due balance
  IF sale_row.customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET due_balance = GREATEST(COALESCE(due_balance, 0) - _amount, 0)
    WHERE id = sale_row.customer_id;
  END IF;

  -- Record in cashbook
  INSERT INTO public.cashbook (owner_id, entry_date, type, category, description, amount, method, note)
  VALUES (
    _owner_id,
    _received_at::date,
    'income',
    'Mobile Banking',
    'SMS Payment: Invoice ' || sale_row.invoice_no || COALESCE(' from ' || _sender_msisdn, ''),
    _amount,
    provider_label,
    CASE WHEN _txn_id IS NOT NULL THEN 'TrxID ' || _txn_id ELSE NULL END
  )
  RETURNING id INTO cb_id;

  -- Link SMS row
  UPDATE public.mfs_sms_inbox
  SET status = 'posted',
      cashbook_id = cb_id,
      matched_sale_id = sale_row.id
  WHERE id = _sms_id;

  RETURN sale_row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.process_mfs_sms(uuid, uuid, numeric, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_mfs_sms(uuid, uuid, numeric, text, text, text, timestamptz) TO service_role;

-- Realtime
ALTER TABLE public.mfs_sms_inbox REPLICA IDENTITY FULL;
ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.cashbook REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='mfs_sms_inbox') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mfs_sms_inbox';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='sales') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sales';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='cashbook') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.cashbook';
  END IF;
END $$;
