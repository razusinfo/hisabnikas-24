
CREATE POLICY "Users manage own logos read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'business-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users manage own logos insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'business-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users manage own logos update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'business-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users manage own logos delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'business-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
