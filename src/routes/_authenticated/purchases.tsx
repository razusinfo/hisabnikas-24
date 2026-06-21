import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtDateTime, fmtDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/DateInput";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Eye, CreditCard, Printer, Trash2, Search, Plus, X } from "lucide-react";
import { useInvoicePreview } from "@/components/InvoicePreviewProvider";


export const Route = createFileRoute("/_authenticated/purchases")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: ["purchases"], queryFn: fetchPurchases });
  },
  component: PurchasesPage,
  errorComponent: ({ error }) => { console.error(error); return <div className="p-8 text-destructive">Something went wrong loading this page.</div>; },
  notFoundComponent: () => <div className="p-4 sm:p-6 lg:p-8">Not found</div>,
});

export async function fetchPurchases() {
  const { data, error } = await (supabase as any)
    .from("purchases")
    .select("id,invoice_no,subtotal,discount,tax,total,paid,due,payment_method,status,note,created_at,supplier_name")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

async function fetchItems(pid: string) {
  const { data, error } = await (supabase as any)
    .from("purchase_items")
    .select("id,product_id,product_name,qty,unit_cost,line_total")
    .eq("purchase_id", pid);
  if (error) throw error;
  return data ?? [];
}

async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,sku,cost,stock")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

type Line = { product_id: string | null; name: string; qty: number; unit_cost: number };

function PurchasesPage() {
  const { t, lang } = useI18n();
  const { showInvoicePreview } = useInvoicePreview();

  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: ["purchases"], queryFn: fetchPurchases });

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [viewP, setViewP] = useState<any | null>(null);
  const [items, setItems] = useState<any[] | null>(null);
  const [payP, setPayP] = useState<any | null>(null);
  const [payAmt, setPayAmt] = useState("");
  const [delP, setDelP] = useState<any | null>(null);

  // New purchase dialog state
  const [openNew, setOpenNew] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [method, setMethod] = useState("cash");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [paid, setPaid] = useState<string>("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const { data: products = [] } = useQuery({ queryKey: ["products-list"], queryFn: fetchProducts, enabled: openNew });

  const { data: profile } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, company_name, logo_url, address, phone, invoice_settings")
        .eq("id", u.user.id)
        .single();
      return data ? { ...data, email: u.user.email || null } : null;
    },
  });

  const methodLabel = (m: string) => {
    const key = `method${m ? m.charAt(0).toUpperCase() + m.slice(1) : ""}` as any;
    const v = (t as any)(key);
    return v && v !== key ? v : m;
  };

  const filtered = useMemo(() => (data as any[]).filter((p) => {
    if (q) {
      const hay = `${p.invoice_no ?? ""} ${p.supplier_name ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    if (status === "due" && Number(p.due) <= 0) return false;
    if (status === "paid" && Number(p.due) > 0) return false;
    if (from && new Date(p.created_at) < new Date(from)) return false;
    if (to && new Date(p.created_at) > new Date(to + "T23:59:59")) return false;
    return true;
  }), [data, q, status, from, to]);

  const stats = useMemo(() => {
    const total = filtered.reduce((a, p) => a + Number(p.total || 0), 0);
    const paidT = filtered.reduce((a, p) => a + Number(p.paid || 0), 0);
    const due = filtered.reduce((a, p) => a + Number(p.due || 0), 0);
    return { count: filtered.length, total, paid: paidT, due };
  }, [filtered]);

  const newSubtotal = lines.reduce((a, l) => a + l.qty * l.unit_cost, 0);
  const newTotal = Math.max(0, newSubtotal - Number(discount || 0) + Number(tax || 0));
  const newPaid = paid === "" ? newTotal : Number(paid);
  const newDue = Math.max(0, newTotal - newPaid);

  function addLine(productId: string) {
    const p = (products as any[]).find((x) => x.id === productId);
    if (!p) return;
    if (lines.some((l) => l.product_id === productId)) return;
    setLines((ls) => [...ls, { product_id: p.id, name: p.name, qty: 1, unit_cost: Number(p.cost || 0) }]);
  }

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number) {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  }

  function resetNew() {
    setSupplier(""); setMethod("cash"); setDiscount("0"); setTax("0"); setPaid(""); setNote(""); setLines([]);
  }

  async function createPurchase() {
    if (lines.length === 0) return toast.error(t("cartEmpty"));
    const { data: u } = await supabase.auth.getUser();
    const invoice_no = "PO-" + Date.now().toString().slice(-8);
    const { data: pur, error } = await (supabase as any).from("purchases").insert({
      owner_id: u.user!.id,
      supplier_name: supplier || null,
      invoice_no,
      subtotal: newSubtotal,
      discount: Number(discount || 0),
      tax: Number(tax || 0),
      total: newTotal,
      paid: newPaid,
      due: newDue,
      payment_method: method,
      status: newDue <= 0 ? "paid" : newPaid > 0 ? "partial" : "due",
      note: note || null,
    }).select().single();
    if (error) return toast.error(error.message);
    const rows = lines.map((l) => ({
      purchase_id: pur.id,
      owner_id: u.user!.id,
      product_id: l.product_id,
      product_name: l.name,
      qty: l.qty,
      unit_cost: l.unit_cost,
      line_total: l.qty * l.unit_cost,
    }));
    const { error: e2 } = await (supabase as any).from("purchase_items").insert(rows);
    if (e2) return toast.error(e2.message);
    toast.success(t("purchaseRecorded"));
    setOpenNew(false);
    resetNew();
    qc.invalidateQueries({ queryKey: ["purchases"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function openView(p: any) {
    setViewP(p); setItems(null);
    setItems(await fetchItems(p.id));
  }

  async function recordPayment() {
    if (!payP) return;
    const amt = Number(payAmt);
    if (!amt || amt <= 0) return toast.error(t("enterValidAmount"));
    if (amt > Number(payP.due)) return toast.error(t("amountExceedsDue"));
    const np = Number(payP.paid) + amt;
    const nd = Number(payP.due) - amt;
    const { error } = await (supabase as any).from("purchases")
      .update({ paid: np, due: nd, status: nd <= 0 ? "paid" : "partial" })
      .eq("id", payP.id);
    if (error) return toast.error(error.message);
    toast.success(t("paymentRecorded"));
    setPayP(null); setPayAmt("");
    qc.invalidateQueries({ queryKey: ["purchases"] });
  }

  async function deletePurchase() {
    if (!delP) return;
    const its = await fetchItems(delP.id);
    // Verify enough stock
    for (const it of its as any[]) {
      if (it.product_id) {
        const { data: p } = await supabase.from("products").select("stock").eq("id", it.product_id).single();
        if (p && Number(p.stock || 0) < Number(it.qty)) {
          return toast.error(t("insufficientStock"));
        }
      }
    }
    for (const it of its as any[]) {
      if (it.product_id) {
        const { data: p } = await supabase.from("products").select("stock").eq("id", it.product_id).single();
        if (p) await supabase.from("products").update({ stock: Number(p.stock || 0) - Number(it.qty) }).eq("id", it.product_id);
      }
    }
    await (supabase as any).from("purchase_items").delete().eq("purchase_id", delP.id);
    const { error } = await (supabase as any).from("purchases").delete().eq("id", delP.id);
    if (error) return toast.error(error.message);
    toast.success(t("purchaseDeleted"));
    setDelP(null);
    qc.invalidateQueries({ queryKey: ["purchases"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  function printDoc(p: any, ls: any[]) {
    showInvoicePreview({
      doc: {
        invoice_no: p.invoice_no,
        created_at: p.created_at,
        partyName: p.supplier_name ?? "—",
        partyPhone: "",
        method: methodLabel(p.payment_method),
        note: p.note ?? "",
        subtotal: p.subtotal,
        total: p.total,
        paid: p.paid,
        due: p.due,
        items: ls.map((l) => ({
          name: l.product_name,
          qty: l.qty,
          price: l.unit_cost,
          total: l.line_total,
        })),
      },
      business: {
        name: profile?.company_name || "",
        owner: profile?.full_name || "",
        address: profile?.address || "",
        phone: profile?.phone || null,
        email: (profile as any)?.email || null,
        logoUrl: profile?.logo_url || null,
      },
      settings: profile?.invoice_settings ?? {},
      lang: lang as "bn" | "en",
      labels: {
        invoice: t("invoice"),
        date: t("date"),
        customer: t("supplier"),
        phone: t("phone"),
        method: t("address") + ":",
        item: t("item"),
        price: t("unitCost"),
        qty: t("qty"),
        total: t("total"),
        subtotal: t("subtotal"),
        paid: t("paid"),
        due: t("due"),
        note: t("note"),
        statusPaid: t("statusPaid"),
        statusDue: t("statusDue"),
        statusPartial: t("statusPartial"),
      },
    });
  }


  async function handlePrint(p: any) {
    printDoc(p, await fetchItems(p.id));
  }

  const statusBadge = (p: any) => Number(p.due) > 0
    ? <Badge variant="outline" className="border-warning/40 text-warning">{Number(p.paid) > 0 ? t("statusPartial") : t("statusDue")}</Badge>
    : <Badge variant="outline" className="border-success/40 text-success">{t("statusPaid")}</Badge>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t("purchases")}
        subtitle={t("purchasesSubtitle")}
        actions={<Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-2" />{t("newPurchase")}</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label={t("transactions")} value={lang === "bn" ? stats.count.toLocaleString("bn-BD") : String(stats.count)} />
        <StatCard label={t("total")} value={fmtMoney(stats.total, lang)} />
        <StatCard label={t("paid")} value={fmtMoney(stats.paid, lang)} tone="success" />
        <StatCard label={t("due")} value={fmtMoney(stats.due, lang)} tone="warning" />
      </div>

      <div className="card-premium p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPurchasesPlaceholder")} className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatus")}</SelectItem>
            <SelectItem value="paid">{t("statusPaid")}</SelectItem>
            <SelectItem value="due">{t("statusDue")}</SelectItem>
          </SelectContent>
        </Select>
        <DateInput value={from} onChange={setFrom} className="w-full sm:w-[160px]" />
        <DateInput value={to} onChange={setTo} className="w-full sm:w-[160px]" />
        {(q || status !== "all" || from || to) && (
          <Button variant="ghost" onClick={() => { setQ(""); setStatus("all"); setFrom(""); setTo(""); }}>{t("clear")}</Button>
        )}
      </div>

      {/* Desktop table */}
      <div className="card-premium overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
              <tr className="text-left">
                <th className="py-3 px-4">{t("invoice")}</th>
                <th className="py-3 px-4">{t("date")}</th>
                <th className="py-3 px-4">{t("supplier")}</th>
                <th className="py-3 px-4">{t("method")}</th>
                <th className="py-3 px-4">{t("status")}</th>
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
              {filtered.map((p: any) => (
                <tr key={p.id} className="border-t border-border/40 hover:bg-muted/30">
                  <td className="py-3 px-4 font-mono">{p.invoice_no}</td>
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{fmtDateTime(p.created_at, lang)}</td>
                  <td className="py-3 px-4">{p.supplier_name || <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-3 px-4">{methodLabel(p.payment_method)}</td>
                  <td className="py-3 px-4">{statusBadge(p)}</td>
                  <td className="py-3 px-4 text-right font-mono">{fmtMoney(p.total, lang)}</td>
                  <td className="py-3 px-4 text-right font-mono text-success">{fmtMoney(p.paid, lang)}</td>
                  <td className="py-3 px-4 text-right font-mono">{Number(p.due) > 0 ? <span className="text-warning">{fmtMoney(p.due, lang)}</span> : "—"}</td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openView(p)} title={t("view")} aria-label={t("view")}><Eye className="h-4 w-4" /></Button>
                      {Number(p.due) > 0 && (
                        <Button size="icon" variant="ghost" onClick={() => { setPayP(p); setPayAmt(String(p.due)); }} title={t("recordPayment")} aria-label={t("recordPayment")}><CreditCard className="h-4 w-4" /></Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => handlePrint(p)} title={t("print")} aria-label={t("print")}><Printer className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDelP(p)} title={t("delete")} aria-label={t("delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="card-premium p-8 text-center text-muted-foreground text-sm">{t("noData")}</div>
        )}
        {filtered.map((p: any) => (
          <div key={p.id} className="card-premium p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-sm font-medium truncate">{p.invoice_no}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(p.created_at, lang)}</div>
              </div>
              {statusBadge(p)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="min-w-0">
                <div className="text-muted-foreground">{t("supplier")}</div>
                <div className="truncate">{p.supplier_name || "—"}</div>
              </div>
              <div className="min-w-0">
                <div className="text-muted-foreground">{t("method")}</div>
                <div className="truncate">{methodLabel(p.payment_method)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("total")}</div>
                <div className="font-mono font-medium">{fmtMoney(p.total, lang)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("due")}</div>
                <div className={`font-mono ${Number(p.due) > 0 ? "text-warning" : ""}`}>{Number(p.due) > 0 ? fmtMoney(p.due, lang) : "—"}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 border-t">
              <Button size="sm" variant="ghost" className="min-h-11 flex-1" onClick={() => openView(p)}><Eye className="h-4 w-4 mr-1" />{t("view")}</Button>
              {Number(p.due) > 0 && (
                <Button size="sm" variant="ghost" className="min-h-11 flex-1" onClick={() => { setPayP(p); setPayAmt(String(p.due)); }}><CreditCard className="h-4 w-4 mr-1" />{t("recordPayment")}</Button>
              )}
              <Button size="sm" variant="ghost" className="min-h-11" onClick={() => handlePrint(p)} aria-label={t("print")}><Printer className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setDelP(p)} aria-label={t("delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>


      {/* New purchase */}
      <Dialog open={openNew} onOpenChange={(o) => { if (!o) { setOpenNew(false); resetNew(); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("newPurchase")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t("supplierName")}</label>
                <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("method")}</label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("methodCash")}</SelectItem>
                    <SelectItem value="card">{t("methodCard")}</SelectItem>
                    <SelectItem value="mobile">{t("methodMobile")}</SelectItem>
                    <SelectItem value="bank">{t("methodBank")}</SelectItem>
                    <SelectItem value="due">{t("methodDue")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">{t("addItem")}</label>
              <Select value="" onValueChange={addLine}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>
                  {(products as any[]).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {lines.length > 0 && (
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase">
                    <tr>
                      <th className="text-left p-2">{t("product")}</th>
                      <th className="text-right p-2 w-24">{t("qty")}</th>
                      <th className="text-right p-2 w-32">{t("unitCost")}</th>
                      <th className="text-right p-2 w-28">{t("total")}</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <tr key={idx} className="border-t border-border/40">
                        <td className="p-2">{l.name}</td>
                        <td className="p-2"><Input type="number" min="0" step="0.01" className="h-8 text-right" value={l.qty} onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })} /></td>
                        <td className="p-2"><Input type="number" min="0" step="0.01" className="h-8 text-right" value={l.unit_cost} onChange={(e) => updateLine(idx, { unit_cost: Number(e.target.value) })} /></td>
                        <td className="p-2 text-right font-mono">{fmtMoney(l.qty * l.unit_cost, lang)}</td>
                        <td className="p-2"><Button size="icon" variant="ghost" onClick={() => removeLine(idx)}><X className="h-4 w-4" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t("discount")}</label>
                <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("tax")}</label>
                <Input type="number" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("paid")}</label>
                <Input type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={String(newTotal)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("note")}</label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm border-t pt-3">
              <div className="text-muted-foreground">{t("subtotal")}</div><div className="text-right font-mono">{fmtMoney(newSubtotal, lang)}</div>
              <div className="font-medium">{t("total")}</div><div className="text-right font-mono font-medium">{fmtMoney(newTotal, lang)}</div>
              <div className="text-success">{t("paid")}</div><div className="text-right font-mono text-success">{fmtMoney(newPaid, lang)}</div>
              <div className="text-warning">{t("due")}</div><div className="text-right font-mono text-warning">{fmtMoney(newDue, lang)}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpenNew(false); resetNew(); }}>{t("cancel")}</Button>
            <Button onClick={createPurchase}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View */}
      <Dialog open={!!viewP} onOpenChange={(o) => !o && setViewP(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("invoice")} {viewP?.invoice_no}</DialogTitle></DialogHeader>
          {viewP && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-muted-foreground text-xs">{t("date")}</div>{fmtDate(viewP.created_at, lang)}</div>
                <div><div className="text-muted-foreground text-xs">{t("supplier")}</div>{viewP.supplier_name ?? "—"}</div>
                <div><div className="text-muted-foreground text-xs">{t("method")}</div>{methodLabel(viewP.payment_method)}</div>
                <div><div className="text-muted-foreground text-xs">{t("status")}</div>{statusBadge(viewP)}</div>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase">
                    <tr><th className="text-left p-2">{t("item")}</th><th className="text-right p-2">{t("qty")}</th><th className="text-right p-2">{t("unitCost")}</th><th className="text-right p-2">{t("total")}</th></tr>
                  </thead>
                  <tbody>
                    {items === null && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">{t("loading")}</td></tr>}
                    {items?.map((i) => (
                      <tr key={i.id} className="border-t border-border/40">
                        <td className="p-2">{i.product_name}</td>
                        <td className="p-2 text-right font-mono">{lang === "bn" ? Number(i.qty).toLocaleString("bn-BD") : i.qty}</td>
                        <td className="p-2 text-right font-mono">{fmtMoney(i.unit_cost, lang)}</td>
                        <td className="p-2 text-right font-mono">{fmtMoney(i.line_total, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">{t("subtotal")}</div><div className="text-right font-mono">{fmtMoney(viewP.subtotal, lang)}</div>
                <div className="text-muted-foreground">{t("discount")}</div><div className="text-right font-mono">{fmtMoney(viewP.discount, lang)}</div>
                <div className="text-muted-foreground">{t("tax")}</div><div className="text-right font-mono">{fmtMoney(viewP.tax, lang)}</div>
                <div className="font-medium">{t("total")}</div><div className="text-right font-mono font-medium">{fmtMoney(viewP.total, lang)}</div>
                <div className="text-success">{t("paid")}</div><div className="text-right font-mono text-success">{fmtMoney(viewP.paid, lang)}</div>
                <div className="text-warning">{t("due")}</div><div className="text-right font-mono text-warning">{fmtMoney(viewP.due, lang)}</div>
              </div>
              {viewP.note && <div className="text-sm"><span className="text-muted-foreground">{t("note")}: </span>{viewP.note}</div>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => viewP && items && printDoc(viewP, items)}><Printer className="h-4 w-4 mr-2" />{t("print")}</Button>
            <Button onClick={() => setViewP(null)}>{t("close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment */}
      <Dialog open={!!payP} onOpenChange={(o) => { if (!o) { setPayP(null); setPayAmt(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("recordPayment")} · {payP?.invoice_no}</DialogTitle></DialogHeader>
          {payP && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("total")}</span><span className="font-mono">{fmtMoney(payP.total, lang)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("alreadyPaid")}</span><span className="font-mono text-success">{fmtMoney(payP.paid, lang)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("outstanding")}</span><span className="font-mono text-warning">{fmtMoney(payP.due, lang)}</span></div>
              <div>
                <label className="text-xs text-muted-foreground">{t("amountReceived")}</label>
                <Input type="number" step="0.01" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPayP(null); setPayAmt(""); }}>{t("cancel")}</Button>
            <Button onClick={recordPayment}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!delP} onOpenChange={(o) => !o && setDelP(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deletePurchaseTitle")} {delP?.invoice_no}?</AlertDialogTitle>
            <AlertDialogDescription>{t("deletePurchaseDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={deletePurchase}>{t("delete")}</AlertDialogAction>
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
