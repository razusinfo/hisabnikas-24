DROP POLICY IF EXISTS "Users can view own google drive connection" ON public.google_drive_connections;
DROP POLICY IF EXISTS "Users can update own google drive connection" ON public.google_drive_connections;
DROP POLICY IF EXISTS "Users can delete own google drive connection" ON public.google_drive_connections;
DROP POLICY IF EXISTS "Users can insert their own google drive connection" ON public.google_drive_connections;
REVOKE ALL ON public.google_drive_connections FROM anon, authenticated;
GRANT ALL ON public.google_drive_connections TO service_role;