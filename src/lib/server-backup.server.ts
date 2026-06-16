// Server-only: runs a backup for a single user using their refresh token.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  refreshAccessToken,
  ensureBackupFolder,
  uploadBackupToDrive,
} from "./google-oauth.server";

async function fetchAllDataForUser(admin: SupabaseClient, userId: string) {
  const [cat, cust, prod, pur, puri, sal, sali, exp, tmpl] = await Promise.all([
    admin.from("categories").select("*").eq("owner_id", userId),
    admin.from("customers").select("*").eq("owner_id", userId),
    admin.from("products").select("*").eq("owner_id", userId),
    admin.from("purchases").select("*").eq("owner_id", userId),
    admin.from("purchase_items").select("*").eq("owner_id", userId),
    admin.from("sales").select("*").eq("owner_id", userId),
    admin.from("sale_items").select("*").eq("owner_id", userId),
    admin.from("expenses").select("*").eq("owner_id", userId),
    admin.from("message_templates").select("*").eq("user_id", userId),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    userId,
    categories: cat.data ?? [],
    customers: cust.data ?? [],
    products: prod.data ?? [],
    purchases: pur.data ?? [],
    purchase_items: puri.data ?? [],
    sales: sal.data ?? [],
    sale_items: sali.data ?? [],
    expenses: exp.data ?? [],
    message_templates: tmpl.data ?? [],
  };
}

export async function runBackupForUser(admin: SupabaseClient, userId: string) {
  const { data: conn, error: connErr } = await admin
    .from("google_drive_connections")
    .select("refresh_token, access_token, access_token_expires_at, folder_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (connErr) throw new Error(connErr.message);
  if (!conn) throw new Error("No Google Drive connection");

  // Refresh access token if needed
  let accessToken = conn.access_token as string | null;
  const expiresAt = conn.access_token_expires_at
    ? new Date(conn.access_token_expires_at as string).getTime()
    : 0;
  if (!accessToken || Date.now() > expiresAt - 60_000) {
    const refreshed = await refreshAccessToken(conn.refresh_token as string);
    accessToken = refreshed.access_token;
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await admin
      .from("google_drive_connections")
      .update({ access_token: accessToken, access_token_expires_at: newExpiry })
      .eq("user_id", userId);
  }

  // Ensure folder
  const folderId = await ensureBackupFolder(accessToken!, conn.folder_id as string | null);
  if (folderId !== conn.folder_id) {
    await admin.from("google_drive_connections").update({ folder_id: folderId }).eq("user_id", userId);
  }

  // Fetch data
  const data = await fetchAllDataForUser(admin, userId);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup-${timestamp}.json`;

  try {
    const result = await uploadBackupToDrive(accessToken!, folderId, filename, data);
    await admin
      .from("google_drive_connections")
      .update({
        last_backup_at: new Date().toISOString(),
        last_backup_status: "success",
        last_backup_error: null,
      })
      .eq("user_id", userId);
    return { ok: true, fileId: result.id, name: result.name };
  } catch (e: any) {
    await admin
      .from("google_drive_connections")
      .update({
        last_backup_at: new Date().toISOString(),
        last_backup_status: "failed",
        last_backup_error: String(e.message || e).slice(0, 500),
      })
      .eq("user_id", userId);
    throw e;
  }
}
