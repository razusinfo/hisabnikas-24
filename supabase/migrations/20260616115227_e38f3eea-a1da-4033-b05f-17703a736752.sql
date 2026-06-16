CREATE TABLE public.google_drive_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  folder_id text,
  auto_daily boolean NOT NULL DEFAULT true,
  last_backup_at timestamptz,
  last_backup_status text,
  last_backup_error text,
  google_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_drive_connections TO authenticated;
GRANT ALL ON public.google_drive_connections TO service_role;

ALTER TABLE public.google_drive_connections ENABLE ROW LEVEL SECURITY;

-- Users can view their own connection metadata (but refresh_token will be filtered in queries)
CREATE POLICY "Users can view own google drive connection"
  ON public.google_drive_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own google drive connection"
  ON public.google_drive_connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own google drive connection"
  ON public.google_drive_connections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT only via server (service role), not directly by client, since refresh_token comes from OAuth exchange.

CREATE TRIGGER update_google_drive_connections_updated_at
  BEFORE UPDATE ON public.google_drive_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
