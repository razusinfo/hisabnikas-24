import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtDateTime, fmtDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Eye, CreditCard, Printer, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sales")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: ["sales"], queryFn: fetchSales });
  },
  component: SalesPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

async function fetchSales() {
  const { data, error } = await supabase
    .from("sales")
    .select("id,invoice_no,subtotal,discount,tax,total,paid,due,payment_method,status,note,created_at,customer_id,customers(name,phone)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

async function fetchSaleItems(saleId: string) {
  const { data, error } = await supabase
    .from("sale_items")
    .select("id,product_name,qty,unit_price,line_total")
    .eq("sale_id", saleId);
  if (error) throw error;
  return data ?? [];
}

function SalesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: ["sales"], queryFn: fetchSales });

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [viewSale, setViewSale] = useState<any | null>(null);
  const [paySale, setPaySale] = useState<any | null>(null);
  const [delSale, setDelSale] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [items, setItems] = useState<any[] | null>(null);

  const filtered = useMemo(() => {
    return (data as any[]).filter((s) => {
      if (q) {
        const hay = `${s.invoice_no ?? ""} ${s.customers?.name ?? ""} ${s.customers?.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (status === "due" && Number(s.due) <= 0) return false;
      if (status === "paid" && Number(s.due) > 0) return false;
      if (from && new Date(s.created_at) < new Date(from)) return false;
      if (to && new Date(s.created_at) > new Date(to + "T23:59:59")) return false;
      return true;
    });
  }, [data, q, status, from, to]);

  const stats = useMemo(() => {
    const total = filtered.reduce((a, s) => a + Number(s.total || 0), 0);
    const paid = filtered.reduce((a, s) => a + Number(s.paid || 0), 0);
    const due = filtered.reduce((a, s) => a + Number(s.due || 0), 0);
    return { count: filtered.length, total, paid, due };
  }, [filtered]);

  async function openView(s: any) {
    setViewSale(s);
    setItems(null);
    const list = await fetchSaleItems(s.id);
    setItems(list);
  }

  async function recordPayment() {
    if (!paySale) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (amt > Number(paySale.due)) return toast.error("Amount exceeds due");
    const newPaid = Number(paySale.paid) + amt;
    const newDue = Number(paySale.due) - amt;
    const { error } = await supabase
      .from("sales")
      .update({ paid: newPaid, due: newDue, status: newDue <= 0 ? "paid" : "partial" })
      .eq("id", paySale.id);
    if (error) return toast.error(error.message);
    if (paySale.customer_id) {
      const { data: c } = await supabase.from("customers").select("due_balance").eq("id", paySale.customer_id).single();
      if (c) {
        await supabase.from("customers").update({ due_balance: Math.max(0, Number(c.due_balance || 0) - amt) }).eq("id", paySale.customer_id);
      }
    }
    toast.success("Payment recorded");
    setPaySale(null);
    setPayAmount("");
    qc.invalidateQueries({ queryKey: ["sales"] });
  }

  async function deleteSale() {
    if (!delSale) return;
    // restore stock
    const { data: itms } = await supabase.from("sale_items").select("product_id,qty").eq("sale_id", delSale.id);
    if (itms) {
      for (const it of itms as any[]) {
        if (it.product_id) {
          const { data: p } = await supabase.from("products").select("stock").eq("id", it.product_id).single();
          if (p) await supabase.from("products").update({ stock: Number(p.stock || 0) + Number(it.qty) }).eq("id", it.product_id);
        }
      }
    }
    // reduce customer due
    if (delSale.customer_id && Number(delSale.due) > 0) {
      const { data: c } = await supabase.from("customers").select("due_balance").eq("id", delSale.customer_id).single();
      if (c) await supabase.from("customers").update({ due_balance: Math.max(0, Number(c.due_balance || 0) - Number(delSale.due)) }).eq("id", delSale.customer_id);
    }
    await supabase.from("sale_items").delete().eq("sale_id", delSale.id);
    const { error } = await supabase.from("sales").delete().eq("id", delSale.id);
    if (error) return toast.error(error.message);
    toast.success("Sale deleted");
    setDelSale(null);
    qc.invalidateQueries({ queryKey: ["sales"] });
  }

  function printInvoice(s: any, lines: any[]) {
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    const rows = lines.map(l => `<tr><td>${l.product_name}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${fmtMoney(l.unit_price)}</td><td style="text-align:right">${fmtMoney(l.line_total)}</td></tr>`).join("");
    w.document.write(`<html><head><title>${s.invoice_no}</title>
      <style>body{font-family:system-ui;padding:24px;color:#111}h1{font-size:20px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:8px;border-bottom:1px solid #eee;font-size:13px;text-align:left}tfoot td{border:0;padding:4px 8px}</style>
      </head><body>
      <h1>Invoice ${s.invoice_no}</h1>
      <div style="color:#666;font-size:13px">${fmtDateTime(s.created_at)}</div>
      <div style="margin-top:8px;font-size:13px">Customer: <b>${s.customers?.name ?? "Walk-in"}</b>${s.customers?.phone ? ` · ${s.customers.phone}`:""}</div>
      <table><thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="3" style="text-align:right">Subtotal</td><td style="text-align:right">${fmtMoney(s.subtotal)}</td></tr>
        <tr><td colspan="3" style="text-align:right">Discount</td><td style="text-align:right">${fmtMoney(s.discount)}</td></tr>
        <tr><td colspan="3" style="text-align:right">Tax</td><td style="text-align:right">${fmtMoney(s.tax)}</td></tr>
        <tr><td colspan="3" style="text-align:right"><b>Total</b></td><td style="text-align:right"><b>${fmtMoney(s.total)}</b></td></tr>
        <tr><td colspan="3" style="text-align:right">Paid</td><td style="text-align:right">${fmtMoney(s.paid)}</td></tr>
        <tr><td colspan="3" style="text-align:right">Due</td><td style="text-align:right">${fmtMoney(s.due)}</td></tr>
      </tfoot></table>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    w.document.close();
  }

  async function handlePrint(s: any) {
    const lines = await fetchSaleItems(s.id);
    printInvoice(s, lines);
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader title={t("sales")} subtitle="Every transaction, neatly archived." />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Transactions" value={String(stats.count)} />
        <StatCard label="Total" value={fmtMoney(stats.total)} />
        <StatCard label="Paid" value={fmtMoney(stats.paid)} tone="success" />
        <StatCard label="Due" value={fmtMoney(stats.due)} tone="warning" />
      </div>

      {/* Filters */}
      <div className="card-premium p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Invoice, customer, phone…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="due">Due</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
        {(q || status !== "all" || from || to) && (
          <Button variant="ghost" onClick={() => { setQ(""); setStatus("all"); setFrom(""); setTo(""); }}>Clear</Button>
        )}
      </div>

      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
              <tr className="text-left">
                <th className="py-3 px-4">{t("invoice")}</th>
                <th className="py-3 px-4">{t("date")}</th>
                <th className="py-3 px-4">{t("customer")}</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">{t("total")}</th>
                <th className="py-3 px-4 text-right">{t("paid")}</th>
                <th className="py-3 px-4 text-right">{t("due")}</th>
                <th className="py-3 px-4 text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">{t("noData")}</td></tr>
              )}
              {filtered.map((s: any) => (
                <tr key={s.id} className="border-t border-border/40 hover:bg-muted/30">
                  <td className="py-3 px-4 font-mono">{s.invoice_no}</td>
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{fmtDateTime(s.created_at)}</td>
                  <td className="py-3 px-4">{s.customers?.name || <span className="text-muted-foreground">Walk-in</span>}</td>
                  <td className="py-3 px-4 capitalize">{s.payment_method}</td>
                  <td className="py-3 px-4">
                    {Number(s.due) > 0
                      ? <Badge variant="outline" className="border-warning/40 text-warning">{Number(s.paid) > 0 ? "Partial" : "Due"}</Badge>
                      : <Badge variant="outline" className="border-success/40 text-success">Paid</Badge>}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">{fmtMoney(s.total)}</td>
                  <td className="py-3 px-4 text-right font-mono text-success">{fmtMoney(s.paid)}</td>
                  <td className="py-3 px-4 text-right font-mono">{Number(s.due) > 0 ? <span className="text-warning">{fmtMoney(s.due)}</span> : "—"}</td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openView(s)} title="View"><Eye className="h-4 w-4" /></Button>
                      {Number(s.due) > 0 && (
                        <Button size="icon" variant="ghost" onClick={() => { setPaySale(s); setPayAmount(String(s.due)); }} title="Record payment"><CreditCard className="h-4 w-4" /></Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => handlePrint(s)} title="Print"><Printer className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDelSale(s)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View dialog */}
      <Dialog open={!!viewSale} onOpenChange={(o) => !o && setViewSale(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice {viewSale?.invoice_no}</DialogTitle>
          </DialogHeader>
          {viewSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-muted-foreground text-xs">Date</div>{fmtDate(viewSale.created_at)}</div>
                <div><div className="text-muted-foreground text-xs">Customer</div>{viewSale.customers?.name ?? "Walk-in"}</div>
                <div><div className="text-muted-foreground text-xs">Method</div><span className="capitalize">{viewSale.payment_method}</span></div>
                <div><div className="text-muted-foreground text-xs">Status</div>{viewSale.status}</div>
              </div>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase">
                    <tr><th className="text-left p-2">Item</th><th className="text-right p-2">Qty</th><th className="text-right p-2">Price</th><th className="text-right p-2">Total</th></tr>
                  </thead>
                  <tbody>
                    {items === null && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Loading…</td></tr>}
                    {items?.map((i) => (
                      <tr key={i.id} className="border-t border-border/40">
                        <td className="p-2">{i.product_name}</td>
                        <td className="p-2 text-right font-mono">{i.qty}</td>
                        <td className="p-2 text-right font-mono">{fmtMoney(i.unit_price)}</td>
                        <td className="p-2 text-right font-mono">{fmtMoney(i.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Subtotal</div><div className="text-right font-mono">{fmtMoney(viewSale.subtotal)}</div>
                <div className="text-muted-foreground">Discount</div><div className="text-right font-mono">{fmtMoney(viewSale.discount)}</div>
                <div className="text-muted-foreground">Tax</div><div className="text-right font-mono">{fmtMoney(viewSale.tax)}</div>
                <div className="font-medium">Total</div><div className="text-right font-mono font-medium">{fmtMoney(viewSale.total)}</div>
                <div className="text-success">Paid</div><div className="text-right font-mono text-success">{fmtMoney(viewSale.paid)}</div>
                <div className="text-warning">Due</div><div className="text-right font-mono text-warning">{fmtMoney(viewSale.due)}</div>
              </div>
              {viewSale.note && <div className="text-sm"><span className="text-muted-foreground">Note: </span>{viewSale.note}</div>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => viewSale && items && printInvoice(viewSale, items)}><Printer className="h-4 w-4 mr-2" />Print</Button>
            <Button onClick={() => setViewSale(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={!!paySale} onOpenChange={(o) => { if (!o) { setPaySale(null); setPayAmount(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment · {paySale?.invoice_no}</DialogTitle>
          </DialogHeader>
          {paySale && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-mono">{fmtMoney(paySale.total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Already paid</span><span className="font-mono text-success">{fmtMoney(paySale.paid)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className="font-mono text-warning">{fmtMoney(paySale.due)}</span></div>
              <div>
                <label className="text-xs text-muted-foreground">Amount received</label>
                <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPaySale(null); setPayAmount(""); }}>{t("cancel")}</Button>
            <Button onClick={recordPayment}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!delSale} onOpenChange={(o) => !o && setDelSale(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sale {delSale?.invoice_no}?</AlertDialogTitle>
            <AlertDialogDescription>Stock will be restored and customer due adjusted. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSale}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="card-premium p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold mt-1 font-mono ${cls}`}>{value}</div>
    </div>
  );
}
