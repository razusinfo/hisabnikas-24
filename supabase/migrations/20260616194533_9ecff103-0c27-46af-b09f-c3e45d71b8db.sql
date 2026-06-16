-- Add explicit deny-all RLS policy on google_drive_connections.
-- Only the server-side admin client (service_role, which bypasses RLS) should access this table.
-- This satisfies the linter (RLS enabled with no policy) and makes the deny-all intent explicit.

CREATE POLICY "Deny all client access to google_drive_connections"
  ON public.google_drive_connections
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Revoke any default privileges from client roles to defense-in-depth.
REVOKE ALL ON public.google_drive_connections FROM authenticated, anon;
GRANT ALL ON public.google_drive_connections TO service_role;