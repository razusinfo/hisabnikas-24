DROP POLICY IF EXISTS "Users manage own cashbook" ON public.cashbook;
CREATE POLICY "Users manage own cashbook" ON public.cashbook FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "owner manages own cashbook categories" ON public.cashbook_categories;
CREATE POLICY "owner manages own cashbook categories" ON public.cashbook_categories FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "own categories" ON public.categories;
CREATE POLICY "own categories" ON public.categories FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "own customers" ON public.customers;
CREATE POLICY "own customers" ON public.customers FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "own products" ON public.products;
CREATE POLICY "own products" ON public.products FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "own purchases" ON public.purchases;
CREATE POLICY "own purchases" ON public.purchases FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "own purchase_items" ON public.purchase_items;
CREATE POLICY "own purchase_items" ON public.purchase_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = purchase_items.purchase_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = purchase_items.purchase_id AND p.owner_id = auth.uid()));

DROP POLICY IF EXISTS "own sales" ON public.sales;
CREATE POLICY "own sales" ON public.sales FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "own sale_items" ON public.sale_items;
CREATE POLICY "own sale_items" ON public.sale_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.owner_id = auth.uid()));