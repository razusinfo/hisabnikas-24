ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS vat numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mrp numeric,
  ADD COLUMN IF NOT EXISTS batch_no text,
  ADD COLUMN IF NOT EXISTS serial_no text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS expiry_date date;