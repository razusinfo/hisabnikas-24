import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { fmtDateTime } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  Download,
  Upload,
  AlertTriangle,
  Cloud,
  CloudUpload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  isSignedIn,
  requestAccessToken,
  signOut as gdSignOut,
  uploadBackup,
  listBackups,
  downloadBackup,
  deleteBackup,
  type DriveBackupFile,
} from "@/lib/google-drive";
import { Switch } from "@/components/ui/switch";
import {
  isAutoBackupEnabled,
  setAutoBackupEnabled,
  getLastAutoBackup,
  runAutoBackup,
} from "@/lib/auto-backup";
import { useServerFn } from "@tanstack/react-start";
import {
  getDriveConnection,
  getDriveAuthUrl,
  setAutoDaily as setAutoDailyFn,
  disconnectDrive,
  runBackupNow,
} from "@/lib/google-drive.functions";

export const Route = createFileRoute("/_authenticated/backup-restore")({
  component: BackupRestorePage,
  validateSearch: (s: Record<string, unknown>) => ({
    drive_connected: s.drive_connected as string | undefined,
    drive_error: s.drive_error as string | undefined,
  }),
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

async function restorePayload(payload: BackupData, t: (k: any) => string) {
  if (!payload.version || !Array.isArray(payload.categories)) {
    throw new Error(t("invalidBackupFile"));
  }
  const { data: u } = await supabase.auth.getUser();
  const currentUserId = u.user?.id;
  if (!currentUserId) throw new Error("Not authenticated");

  const remap = (row: any, key: string) =>
    row && key in row ? { ...row, [key]: currentUserId } : row;

  const tables: [string, any[]][] = [
    ["categories", (payload.categories || []).map((r) => remap(r, "owner_id"))],
    ["customers", (payload.customers || []).map((r) => remap(r, "owner_id"))],
    ["products", (payload.products || []).map((r) => remap(r, "owner_id"))],
    ["purchases", (payload.purchases || []).map((r) => remap(r, "owner_id"))],
    ["sales", (payload.sales || []).map((r) => remap(r, "owner_id"))],
    ["purchase_items", (payload.purchase_items || []).map((r) => remap(r, "owner_id"))],
    ["sale_items", (payload.sale_items || []).map((r) => remap(r, "owner_id"))],
    ["expenses", (payload.expenses || []).map((r) => remap(r, "owner_id"))],
    ["message_templates", (payload.message_templates || []).map((r) => remap(r, "user_id"))],
  ];

  for (const [table, rows] of tables) {
    if (!rows.length) continue;
    const { error } = await supabase.from(table as any).upsert(rows, { onConflict: "id" });
    if (error) {
      console.error(`Restore error on ${table}:`, error);
      throw new Error(`${t("restoreTableError")}: ${table}`);
    }
  }
}

function formatBytes(s?: string) {
  const n = Number(s);
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function BackupRestorePage() {
  const { t, lang } = useI18n();
  const search = useSearch({ from: "/_authenticated/backup-restore" });
  const qc = useQueryClient();
  const [restoring, setRestoring] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [uploadingDrive, setUploadingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveBackupFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [autoDaily, setAutoDaily] = useState(false);
  const [lastAuto, setLastAuto] = useState(0);
  const [autoRunning, setAutoRunning] = useState(false);

  // Server-side connection
  const getConn = useServerFn(getDriveConnection);
  const getAuthUrl = useServerFn(getDriveAuthUrl);
  const setAutoDailyServer = useServerFn(setAutoDailyFn);
  const disconnectServer = useServerFn(disconnectDrive);
  const runBackupNowServer = useServerFn(runBackupNow);

  const connQ = useQuery({
    queryKey: ["drive-connection"],
    queryFn: () => getConn(),
  });
  const serverConn = connQ.data;
  const [serverRunning, setServerRunning] = useState(false);
  const [serverConnecting, setServerConnecting] = useState(false);

  useEffect(() => {
    if (search.drive_connected) {
      toast.success(t("autoBackupActive"));
      qc.invalidateQueries({ queryKey: ["drive-connection"] });
    }
    if (search.drive_error) {
      toast.error(`Google: ${search.drive_error}`);
    }
  }, [search.drive_connected, search.drive_error]);

  useEffect(() => {
    setDriveConnected(isSignedIn());
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null;
      setUserId(id);
      if (id) {
        setAutoDaily(isAutoBackupEnabled(id));
        setLastAuto(getLastAutoBackup(id));
      }
    });
  }, []);

  const toggleAutoDaily = (next: boolean) => {
    if (!userId) return;
    setAutoBackupEnabled(userId, next);
    setAutoDaily(next);
    if (next && !driveConnected) {
      toast.message(t("connectGoogleDrive"));
    }
  };

  const handleRunAutoNow = async () => {
    if (!userId) return;
    setAutoRunning(true);
    try {
      await runAutoBackup(userId);
      setLastAuto(getLastAutoBackup(userId));
      toast.success(t("driveBackupUploaded"));
      await refreshDriveList();
    } catch (e: any) {
      toast.error(e.message || t("backupFailed"));
    } finally {
      setAutoRunning(false);
    }
  };



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

  const handleRestoreFile = async (file: File) => {
    setRestoring(true);
    try {
      const text = await file.text();
      const payload: BackupData = JSON.parse(text);
      await restorePayload(payload, t);
      toast.success(t("restoreSuccess"));
    } catch (e: any) {
      toast.error(e.message || t("restoreFailed"));
    } finally {
      setRestoring(false);
    }
  };

  const refreshDriveList = async () => {
    setLoadingFiles(true);
    try {
      const files = await listBackups();
      setDriveFiles(files);
    } catch (e: any) {
      toast.error(e.message || "Failed to load backups");
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleConnectDrive = async () => {
    setConnecting(true);
    try {
      await requestAccessToken("consent");
      setDriveConnected(true);
      toast.success(t("connected"));
      await refreshDriveList();
    } catch (e: any) {
      toast.error(e.message || "Google sign-in failed");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectDrive = () => {
    gdSignOut();
    setDriveConnected(false);
    setDriveFiles([]);
  };

  const handleBackupToDrive = async () => {
    setUploadingDrive(true);
    try {
      const data = await fetchAllData();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      await uploadBackup(`backup-${timestamp}.json`, data);
      toast.success(t("driveBackupUploaded"));
      await refreshDriveList();
    } catch (e: any) {
      toast.error(e.message || t("backupFailed"));
    } finally {
      setUploadingDrive(false);
    }
  };

  const handleRestoreFromDrive = async (file: DriveBackupFile) => {
    setBusyFileId(file.id);
    setRestoring(true);
    try {
      const payload = (await downloadBackup(file.id)) as BackupData;
      await restorePayload(payload, t);
      toast.success(t("restoreSuccess"));
    } catch (e: any) {
      toast.error(e.message || t("restoreFailed"));
    } finally {
      setRestoring(false);
      setBusyFileId(null);
    }
  };

  const handleDeleteDriveFile = async (file: DriveBackupFile) => {
    if (!confirm(t("confirmDeleteBackup"))) return;
    setBusyFileId(file.id);
    try {
      await deleteBackup(file.id);
      toast.success(t("driveBackupDeleted"));
      setDriveFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setBusyFileId(null);
    }
  };

  const handleServerConnect = async () => {
    setServerConnecting(true);
    try {
      const { url } = await getAuthUrl();
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message || "Failed to start connect");
      setServerConnecting(false);
    }
  };

  const handleServerDisconnect = async () => {
    if (!confirm(t("disconnect") + "?")) return;
    try {
      await disconnectServer();
      qc.invalidateQueries({ queryKey: ["drive-connection"] });
      toast.success(t("disconnect"));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleServerAuto = async (next: boolean) => {
    try {
      await setAutoDailyServer({ data: { enabled: next } });
      qc.invalidateQueries({ queryKey: ["drive-connection"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleServerRunNow = async () => {
    setServerRunning(true);
    try {
      await runBackupNowServer();
      toast.success(t("driveBackupUploaded"));
      qc.invalidateQueries({ queryKey: ["drive-connection"] });
    } catch (e: any) {
      toast.error(e.message || t("backupFailed"));
    } finally {
      setServerRunning(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl space-y-6">
      <PageHeader title={t("backupRestore")} subtitle={t("backupRestoreSubtitle")} />

      {/* Server-side daily auto-backup */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t("serverAutoBackup")}
          </CardTitle>
          <CardDescription>{t("serverAutoBackupDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connQ.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : !serverConn ? (
            <Button onClick={handleServerConnect} disabled={serverConnecting}>
              {serverConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Cloud className="h-4 w-4 mr-2" />
              )}
              {t("connectForAutoBackup")}
            </Button>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("autoBackupActive")}
                </div>
                {serverConn.google_email && (
                  <span className="text-xs text-muted-foreground">
                    {t("serverConnectedAs")}: {serverConn.google_email}
                  </span>
                )}
                <Button size="sm" variant="outline" onClick={handleServerDisconnect} className="ml-auto">
                  {t("disconnect")}
                </Button>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{t("autoBackupDaily")}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("serverAutoBackupDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={!!serverConn.auto_daily}
                    onCheckedChange={handleToggleServerAuto}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {t("lastServerBackup")}:{" "}
                    {serverConn.last_backup_at
                      ? new Date(serverConn.last_backup_at).toLocaleString()
                      : t("never")}
                    {serverConn.last_backup_status === "success" && (
                      <span className="ml-2 text-emerald-600">✓ {t("backupStatusSuccess")}</span>
                    )}
                    {serverConn.last_backup_status === "failed" && (
                      <span className="ml-2 text-destructive">✗ {t("backupStatusFailed")}</span>
                    )}
                  </span>
                  <Button size="sm" variant="ghost" onClick={handleServerRunNow} disabled={serverRunning}>
                    {serverRunning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <CloudUpload className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {t("backupNow")}
                  </Button>
                </div>
                {serverConn.last_backup_error && (
                  <p className="text-xs text-destructive">{serverConn.last_backup_error}</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>


      {/* Google Drive */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-muted-foreground" />
            {t("googleDrive")}
          </CardTitle>
          <CardDescription>{t("googleDriveDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!driveConnected ? (
            <Button onClick={handleConnectDrive} disabled={connecting}>
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Cloud className="h-4 w-4 mr-2" />
              )}
              {t("connectGoogleDrive")}
            </Button>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("connected")}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDisconnectDrive}
                  className="ml-auto"
                >
                  {t("disconnect")}
                </Button>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{t("autoBackupDaily")}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("autoBackupDailyDesc")}
                    </p>
                  </div>
                  <Switch checked={autoDaily} onCheckedChange={toggleAutoDaily} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {t("lastAutoBackup")}:{" "}
                    {lastAuto ? new Date(lastAuto).toLocaleString() : t("never")}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRunAutoNow}
                    disabled={autoRunning}
                  >
                    {autoRunning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <CloudUpload className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {t("backupNow")}
                  </Button>
                </div>
              </div>


              <div className="flex flex-wrap gap-2">
                <Button onClick={handleBackupToDrive} disabled={uploadingDrive}>
                  {uploadingDrive ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CloudUpload className="h-4 w-4 mr-2" />
                  )}
                  {t("backupToDrive")}
                </Button>
                <Button variant="outline" onClick={refreshDriveList} disabled={loadingFiles}>
                  {loadingFiles ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {t("refresh")}
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">{t("driveBackups")}</Label>
                {driveFiles.length === 0 && !loadingFiles ? (
                  <p className="text-sm text-muted-foreground">{t("noDriveBackups")}</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {driveFiles.map((f) => (
                      <li
                        key={f.id}
                        className="flex flex-wrap items-center gap-2 p-3 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{f.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(f.modifiedTime).toLocaleString()}
                            {f.size ? ` • ${formatBytes(f.size)}` : ""}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestoreFromDrive(f)}
                          disabled={restoring || busyFileId === f.id}
                        >
                          {busyFileId === f.id && restoring ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          <span className="ml-1.5">{t("restoreFromDrive")}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteDriveFile(f)}
                          disabled={busyFileId === f.id}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Local backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-muted-foreground" />
            {t("backupData")}
          </CardTitle>
          <CardDescription>{t("backupDataDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleBackup} disabled={backupQ.isFetching} variant="outline">
            {backupQ.isFetching && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Download className="h-4 w-4 mr-2" />
            {t("downloadBackup")}
          </Button>
        </CardContent>
      </Card>

      {/* Restore from local file */}
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
            <Label>{t("localFile")}</Label>
            <Input
              type="file"
              accept="application/json"
              disabled={restoring}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleRestoreFile(file);
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
