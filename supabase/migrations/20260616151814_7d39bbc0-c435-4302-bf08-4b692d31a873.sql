CREATE POLICY "Users can insert their own google drive connection"
ON public.google_drive_connections
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);