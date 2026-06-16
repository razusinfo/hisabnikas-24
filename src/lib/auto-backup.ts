// Daily auto-backup to the user's own Google Drive.
// Runs silently in the browser when the user is logged into the app and has
// previously connected Google Drive (so a token can be obtained without UI).

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requestAccessToken, uploadBackup } from "@/lib/google-drive";

const DAY_MS = 24 * 60 * 60 * 1000;

export const autoBackupKeys = {
  enabled: (userId: string) => `auto-backup-daily:${userId}`,
  last: (userId: string) => `auto-backup-last:${userId}`,
};

export function isAutoBackupEnabled(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(autoBackupKeys.enabled(userId)) === "1";
}

export function setAutoBackupEnabled(userId: string, enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) localStorage.setItem(autoBackupKeys.enabled(userId), "1");
  else localStorage.removeItem(autoBackupKeys.enabled(userId));
}

export function getLastAutoBackup(userId: string): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(autoBackupKeys.last(userId)) || 0);
}

async function fetchAllData(userId: string) {
  const [cat, cust, prod, pur, puri, sal, sali, exp, tmpl] = await Promise.all([
    supabase.from("categories").select("*").eq("owner_id", userId),
    supabase.from("customers").select("*").eq("owner_id", userId),
    supabase.from("products").select("*").eq("owner_id", userId),
    supabase.from("purchases").select("*").eq("owner_id", userId),
    supabase.from("purchase_items").select("*").eq("owner_id", userId),
    supabase.from("sales").select("*").eq("owner_id", userId),
    supabase.from("sale_items").select("*").eq("owner_id", userId),
    supabase.from("expenses").select("*").eq("owner_id", userId),
    supabase.from("message_templates").select("*").eq("user_id", userId),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
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

export async function runAutoBackup(userId: string): Promise<boolean> {
  // Try to get a token without showing UI; if user hasn't previously consented
  // this may pop up — we use prompt "" to minimize UI and just bail on error.
  await requestAccessToken("");
  const data = await fetchAllData(userId);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  await uploadBackup(`auto-backup-${timestamp}.json`, data);
  localStorage.setItem(autoBackupKeys.last(userId), String(Date.now()));
  return true;
}

/**
 * Hook used at the app shell level. Once per app load, if the signed-in user
 * has auto-backup enabled and last backup was >24h ago, run a silent backup.
 */
export function useAutoBackup() {
  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId || cancelled) return;
        if (!isAutoBackupEnabled(userId)) return;
        const last = getLastAutoBackup(userId);
        if (Date.now() - last < DAY_MS) return;
        await runAutoBackup(userId);
      } catch (e) {
        // Silent failure — user will see status on the Backup page.
        console.warn("Auto-backup skipped:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
