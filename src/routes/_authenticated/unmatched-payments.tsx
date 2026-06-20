import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtMoney, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Inbox, Search, Link2, X, Eye, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/unmatched-payments")({
  component: UnmatchedPayments,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-4">Not found</div>,
});

type SmsRow = {
  id: string;
  raw_body: string;
  sender: string | null;
  received_at: string;
  provider: string | null;
  txn_id: string | null;
  amount: number | null;
  sender_msisdn: string | null;
  account_number: string | null;
  status: string;
  matched_sale_id: string | null;
  error: string | null;
};

type Sale = {
  id: string;
  invoice_no: string;
  total: number;
  paid: number;
  due: number;
  status: string;
  customer_id: string | null;
  created_at: string;
};

const PROVIDER_COLORS: Record<string, string> = {
  bkash: "bg-pink-100 text-pink-800 border-pink-200",
  nagad: "bg-orange-100 text-orange-800 border-orange-200",
  rocket: "bg-purple-100 text-purple-800 border-purple-200",
  upay: "bg-amber-100 text-amber-800 border-amber-200",
  unknown: "bg-slate-100 text-slate-700 border-slate-200",
};

function providerLabel(p: string | null) {
  switch (p) {
    case "bkash": return "বিকাশ";
    case "nagad": return "নগদ";
    case "rocket": return "রকেট";
    case "upay": return "উপায়";
    default: return "Unknown";
  }
}

function UnmatchedPayments() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [viewSms, setViewSms] = useState<SmsRow | null>(null);
  const [matchTarget, setMatchTarget] = useState<SmsRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["unmatched-sms", providerFilter],
    queryFn: async (): Promise<SmsRow[]> => {
      let q = (supabase as any)
        .from("mfs_sms_inbox")
        .select("id, raw_body, sender, received_at, provider, txn_id, amount, sender_msisdn, account_number, status, matched_sale_id, error")
        .in("status", ["pending", "ignored", "error"])
        .order("received_at", { ascending: false })
        .limit(200);
      if (providerFilter !== "all") q = q.eq("provider", providerFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SmsRow[];
    },
  });

  // Realtime refresh
  useEffect(() => {
    const channel = supabase
      .channel("unmatched-sms-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "mfs_sms_inbox" }, () => {
        qc.invalidateQueries({ queryKey: ["unmatched-sms"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      r.raw_body.toLowerCase().includes(s) ||
      (r.txn_id ?? "").toLowerCase().includes(s) ||
      (r.sender_msisdn ?? "").includes(s) ||
      String(r.amount ?? "").includes(s)
    );
  }, [rows, search]);

  async function handleDismiss(sms: SmsRow) {
    const { error } = await (supabase as any).rpc("dismiss_mfs_sms", { _sms_id: sms.id, _reason: "Manually dismissed" });
    if (error) { toast.error(error.message); return; }
    toast.success("Dismissed");
    qc.invalidateQueries({ queryKey: ["unmatched-sms"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unmatched Payments"
        subtitle="যেসব মোবাইল ব্যাংকিং SMS এখনও কোনো invoice এর সাথে match হয়নি"
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search amount, TrxID, phone, body..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(["all", "bkash", "nagad", "rocket", "upay", "unknown"] as const).map(p => (
              <Button
                key={p}
                size="sm"
                variant={providerFilter === p ? "default" : "outline"}
                onClick={() => setProviderFilter(p)}
              >
                {p === "all" ? "All" : providerLabel(p)}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["unmatched-sms"] })}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Time</th>
                <th className="text-left px-3 py-2">Provider</th>
                <th className="text-left px-3 py-2">TrxID</th>
                <th className="text-left px-3 py-2">Sender</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">কোনো unmatched payment নেই</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.received_at)}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={PROVIDER_COLORS[r.provider ?? "unknown"]}>{providerLabel(r.provider)}</Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.txn_id ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.sender_msisdn ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-medium">{r.amount != null ? fmtMoney(r.amount) : "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={r.status === "error" ? "destructive" : "secondary"}>{r.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setViewSms(r)}><Eye className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setMatchTarget(r)} disabled={!r.amount}>
                      <Link2 className="h-4 w-4 mr-1" /> Match
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDismiss(r)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!viewSms} onOpenChange={(v) => !v && setViewSms(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Raw SMS</DialogTitle></DialogHeader>
          {viewSms && (
            <div className="space-y-2 text-sm">
              <div><b>Sender:</b> {viewSms.sender ?? "—"}</div>
              <div><b>Received:</b> {fmtDate(viewSms.received_at)}</div>
              <div className="p-3 bg-muted rounded font-mono whitespace-pre-wrap">{viewSms.raw_body}</div>
              {viewSms.error && <div className="text-destructive text-xs">Error: {viewSms.error}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <MatchDialog sms={matchTarget} onClose={() => setMatchTarget(null)} />
    </div>
  );
}

function MatchDialog({ sms, onClose }: { sms: SmsRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => { setSearch(""); setNote(""); }, [sms?.id]);

  const { data: sales = [] } = useQuery({
    queryKey: ["match-candidates", sms?.id, sms?.amount, search],
    enabled: !!sms,
    queryFn: async (): Promise<Sale[]> => {
      let q = (supabase as any)
        .from("sales")
        .select("id, invoice_no, total, paid, due, status, customer_id, created_at")
        .in("status", ["due", "partial"])
        .order("created_at", { ascending: false })
        .limit(30);
      if (search.trim()) q = q.ilike("invoice_no", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  async function pick(saleId: string) {
    if (!sms) return;
    const { error } = await (supabase as any).rpc("manual_match_mfs_sms", {
      _sms_id: sms.id,
      _sale_id: saleId,
      _note: note || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Matched to invoice");
    qc.invalidateQueries({ queryKey: ["unmatched-sms"] });
    qc.invalidateQueries({ queryKey: ["sales"] });
    onClose();
  }

  return (
    <Dialog open={!!sms} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Match SMS to Invoice</DialogTitle></DialogHeader>
        {sms && (
          <div className="space-y-3">
            <div className="p-3 rounded bg-muted text-sm">
              <div className="flex justify-between"><span><b>Amount:</b> {fmtMoney(sms.amount ?? 0)}</span><span><b>TrxID:</b> {sms.txn_id ?? "—"}</span></div>
              <div className="text-xs text-muted-foreground mt-1">From {sms.sender_msisdn ?? "—"} • {fmtDate(sms.received_at)}</div>
            </div>
            <Input placeholder="Search invoice no..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Input placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="max-h-72 overflow-y-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="text-left px-2 py-1">Invoice</th>
                    <th className="text-right px-2 py-1">Total</th>
                    <th className="text-right px-2 py-1">Due</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No pending invoices</td></tr>
                  ) : sales.map(s => {
                    const exact = sms.amount != null && Math.abs(Number(s.due) - sms.amount) < 0.01;
                    return (
                      <tr key={s.id} className={`border-t ${exact ? "bg-green-50 dark:bg-green-950/30" : ""}`}>
                        <td className="px-2 py-1 font-mono">{s.invoice_no}</td>
                        <td className="px-2 py-1 text-right">{fmtMoney(s.total)}</td>
                        <td className="px-2 py-1 text-right font-medium">{fmtMoney(s.due)} {exact && <Badge className="ml-1 bg-green-600">exact</Badge>}</td>
                        <td className="px-2 py-1 text-right">
                          <Button size="sm" onClick={() => pick(s.id)}>Match</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
