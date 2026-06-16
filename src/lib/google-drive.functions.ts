import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHost } from "@tanstack/react-start/server";

function getRedirectUri(): string {
  const host = getRequestHost();
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}/api/public/google/callback`;
}

export const getDriveConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("google_drive_connections")
      .select("google_email, auto_daily, last_backup_at, last_backup_status, last_backup_error")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const getDriveAuthUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildAuthUrl, signState } = await import("@/lib/google-oauth.server");
    const redirectUri = getRedirectUri();
    const state = signState(context.userId);
    return { url: buildAuthUrl(redirectUri, state) };
  });

export const setAutoDaily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("google_drive_connections")
      .update({ auto_daily: data.enabled })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("google_drive_connections")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runBackupForUser } = await import("@/lib/server-backup.server");
    const result = await runBackupForUser(supabaseAdmin, context.userId);
    return result;
  });
