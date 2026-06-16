import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Download, Upload, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/backup-restore")({
  component: BackupRestorePage,
});

type BackupData = {
  version: number;
  exportedAt: string;
  categories: any[];
  customers: any[];
  products: any[];
  purchases: any[];
  purchase_items: any[];
  sales: any[];
  sale_items: any[];
  expenses: any[];
  message_templates: any[];
};

async function fetchAllData(): Promise<BackupData> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) throw new Error("Not authenticated");

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

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function BackupRestorePage() {
  const { t } = useI18n();
  const [restoring, setRestoring] = useState(false);

  const backupQ = useQuery({
    queryKey: ["backup-data"],
    queryFn: fetchAllData,
    enabled: false,
  });

  const handleBackup = async () => {
    try {
      const data = await backupQ.refetch().then((r) => r.data!);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      downloadJson(`backup-${timestamp}.json`, data);
      toast.success(t("backupSuccess"));
    } catch (e: any) {
      toast.error(e.message || t("backupFailed"));
    }
  };

  const handleRestore = async (file: File) => {
    setRestoring(true);
    try {
      const text = await file.text();
      const payload: BackupData = JSON.parse(text);

      if (!payload.version || !Array.isArray(payload.categories)) {
        throw new Error(t("invalidBackupFile"));
      }

      const { data: u } = await supabase.auth.getUser();
      const currentUserId = u.user?.id;
      if (!currentUserId) throw new Error("Not authenticated");

      const remapUserId = (row: any, key: string) => {
        if (row && key in row) {
          return { ...row, [key]: currentUserId };
        }
        return row;
      };

      const tables: [string, any[], string][] = [
        ["categories", payload.categories.map((r) => remapUserId(r, "owner_id")), "owner_id"],
        ["customers", payload.customers.map((r) => remapUserId(r, "owner_id")), "owner_id"],
        ["products", payload.products.map((r) => remapUserId(r, "owner_id")), "owner_id"],
        ["purchases", payload.purchases.map((r) => remapUserId(r, "owner_id")), "owner_id"],
        ["sales", payload.sales.map((r) => remapUserId(r, "owner_id")), "owner_id"],
        ["purchase_items", payload.purchase_items.map((r) => remapUserId(r, "owner_id")), "owner_id"],
        ["sale_items", payload.sale_items.map((r) => remapUserId(r, "owner_id")), "owner_id"],
        ["expenses", payload.expenses.map((r) => remapUserId(r, "owner_id")), "owner_id"],
        ["message_templates", payload.message_templates.map((r) => remapUserId(r, "user_id")), "user_id"],
      ];

      for (const [table, rows] of tables) {
        if (!rows.length) continue;
        const { error } = await supabase.from(table as any).upsert(rows, { onConflict: "id" });
        if (error) {
          console.error(`Restore error on ${table}:`, error);
          throw new Error(`${t("restoreTableError")}: ${table}`);
        }
      }

      toast.success(t("restoreSuccess"));
    } catch (e: any) {
      toast.error(e.message || t("restoreFailed"));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl space-y-6">
      <PageHeader title={t("backupRestore")} subtitle={t("backupRestoreSubtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-muted-foreground" />
            {t("backupData")}
          </CardTitle>
          <CardDescription>{t("backupDataDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleBackup} disabled={backupQ.isFetching}>
            {backupQ.isFetching && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Download className="h-4 w-4 mr-2" />
            {t("downloadBackup")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-muted-foreground" />
            {t("restoreData")}
          </CardTitle>
          <CardDescription>{t("restoreDataDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>{t("restoreWarning")}</p>
          </div>
          <div className="grid gap-2">
            <Label>{t("selectBackupFile")}</Label>
            <Input
              type="file"
              accept="application/json"
              disabled={restoring}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleRestore(file);
                  e.target.value = "";
                }
              }}
            />
          </div>
          {restoring && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("restoring")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
