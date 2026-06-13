import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Eye, CreditCard, Printer, Trash2, Search, Plus, Pencil, Save as SaveIcon, X } from "lucide-react";


export const Route = createFileRoute("/_authenticated/sales")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: ["sales"], queryFn: fetchSales });
  },
  component: SalesPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

export async function fetchSales() {
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
  const { t, lang } = useI18n();
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // New sale dialog state
  const [openNew, setOpenNew] = useState(false);
  const [customerId, setCustomerId] = useState<string>("walkin");
  const [newMethod, setNewMethod] = useState("cash");
  const [newDiscount, setNewDiscount] = useState("0");
  const [newTax, setNewTax] = useState("0");
  const [newPaid, setNewPaid] = useState<string>("");
  const [newNote, setNewNote] = useState("");
  const [lines, setLines] = useState<{ product_id: string; name: string; qty: number; unit_price: number; stock: number }[]>([]);
  const [creating, setCreating] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, company_name, currency, logo_url, invoice_settings")
        .eq("id", u.user.id)
        .single();
      return data;
    },
  });

  const { data: logoUrl } = useQuery({
    queryKey: ["logo-signed", profile?.logo_url],
    enabled: !!profile?.logo_url,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("business-logos")
        .createSignedUrl(profile!.logo_url!, 3600);
      if (error) return null;
      return data.signedUrl;
    },
  });

  const { data: productsList = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name,sku,sell_price,stock").order("name");
      if (error) throw error;
      return (data ?? []).map((p: any) => ({ ...p, price: p.sell_price }));
      if (error) throw error;
    },
    enabled: openNew,
  });
  const { data: customersList = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id,name,phone").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: openNew,
  });

  const newSubtotal = lines.reduce((a, l) => a + l.qty * l.unit_price, 0);
  const newTotal = Math.max(0, newSubtotal - Number(newDiscount || 0) + Number(newTax || 0));
  const newPaidAmt = newPaid === "" ? newTotal : Number(newPaid);
  const newDue = Math.max(0, newTotal - newPaidAmt);

  function addLine(productId: string) {
    const p = (productsList as any[]).find((x) => x.id === productId);
    setProductSearch("");
    if (!p) return;
    if (lines.some((l) => l.product_id === productId)) {
      setLines((ls) => ls.map((l) => l.product_id === productId ? { ...l, qty: l.qty + 1 } : l));
      return;
    }
    setLines((ls) => [...ls, { product_id: p.id, name: p.name, qty: 1, unit_price: Number(p.price || 0), stock: Number(p.stock || 0) }]);
  }
  function updateLine(idx: number, patch: Partial<{ qty: number; unit_price: number }>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLine(idx: number) {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  }
  function resetNew() {
    setCustomerId("walkin"); setNewMethod("cash"); setNewDiscount("0"); setNewTax("0"); setNewPaid(""); setNewNote(""); setLines([]);
  }

  async function createSale() {
    if (lines.length === 0) return toast.error(t("cartEmpty"));
    for (const l of lines) {
      if (l.qty > l.stock) return toast.error(`${l.name}: ${t("insufficientStock")}`);
    }
    setCreating(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const invoice_no = "INV-" + Date.now().toString().slice(-8);
      const status = newDue <= 0 ? "paid" : newPaidAmt > 0 ? "partial" : "due";
      const { data: sale, error } = await supabase.from("sales").insert({
        owner_id: u.user!.id,
        customer_id: customerId === "walkin" ? null : customerId,
        invoice_no,
        subtotal: newSubtotal,
        discount: Number(newDiscount || 0),
        tax: Number(newTax || 0),
        total: newTotal,
        paid: newPaidAmt,
        due: newDue,
        payment_method: newMethod,
        status,
        note: newNote || null,
      }).select().single();
      if (error) throw error;
      const rows = lines.map((l) => ({
        sale_id: sale.id,
        owner_id: u.user!.id,
        product_id: l.product_id,
        product_name: l.name,
        qty: l.qty,
        unit_price: l.unit_price,
        line_total: l.qty * l.unit_price,
      }));
      const { error: e2 } = await supabase.from("sale_items").insert(rows);
      if (e2) throw e2;
      toast.success(t("saleRecorded"));
      setOpenNew(false);
      resetNew();
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-list"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  const methodLabel = (m: string) => {
    const key = `method${m ? m.charAt(0).toUpperCase() + m.slice(1) : ""}` as any;
    const v = (t as any)(key);
    return v && v !== key ? v : m;
  };

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
    setEditing(false);
    const list = await fetchSaleItems(s.id);
    setItems(list);
  }

  function updateItem(id: string, patch: { qty?: number; unit_price?: number }) {
    setItems((prev) => prev?.map((i) => {
      if (i.id !== id) return i;
      const next = { ...i, ...patch };
      next.line_total = Number(next.qty || 0) * Number(next.unit_price || 0);
      return next;
    }) ?? null);
  }

  async function saveEdits() {
    if (!viewSale || !items) return;
    setSaving(true);
    try {
      for (const i of items) {
        const { error } = await supabase
          .from("sale_items")
          .update({ qty: Number(i.qty), unit_price: Number(i.unit_price), line_total: Number(i.qty) * Number(i.unit_price) })
          .eq("id", i.id);
        if (error) throw error;
      }
      const subtotal = items.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
      const discount = Number(viewSale.discount || 0);
      const tax = Number(viewSale.tax || 0);
      const total = Math.max(0, subtotal - discount + tax);
      const paid = Number(viewSale.paid || 0);
      const due = Math.max(0, total - paid);
      const { error: e2 } = await supabase
        .from("sales")
        .update({ subtotal, total, due, status: due <= 0 ? "paid" : paid > 0 ? "partial" : "due" })
        .eq("id", viewSale.id);
      if (e2) throw e2;
      toast.success(t("save"));
      setEditing(false);
      setViewSale({ ...viewSale, subtotal, total, due });
      qc.invalidateQueries({ queryKey: ["sales"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function recordPayment() {
    if (!paySale) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return toast.error(t("enterValidAmount"));
    if (amt > Number(paySale.due)) return toast.error(t("amountExceedsDue"));
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
    toast.success(t("paymentRecorded"));
    setPaySale(null);
    setPayAmount("");
    qc.invalidateQueries({ queryKey: ["sales"] });
  }

  async function deleteSale() {
    if (!delSale) return;
    const { data: itms } = await supabase.from("sale_items").select("product_id,qty").eq("sale_id", delSale.id);
    if (itms) {
      for (const it of itms as any[]) {
        if (it.product_id) {
          const { data: p } = await supabase.from("products").select("stock").eq("id", it.product_id).single();
          if (p) await supabase.from("products").update({ stock: Number(p.stock || 0) + Number(it.qty) }).eq("id", it.product_id);
        }
      }
    }
    if (delSale.customer_id && Number(delSale.due) > 0) {
      const { data: c } = await supabase.from("customers").select("due_balance").eq("id", delSale.customer_id).single();
      if (c) await supabase.from("customers").update({ due_balance: Math.max(0, Number(c.due_balance || 0) - Number(delSale.due)) }).eq("id", delSale.customer_id);
    }
    await supabase.from("sale_items").delete().eq("sale_id", delSale.id);
    const { error } = await supabase.from("sales").delete().eq("id", delSale.id);
    if (error) return toast.error(error.message);
    toast.success(t("saleDeleted"));
    setDelSale(null);
    qc.invalidateQueries({ queryKey: ["sales"] });
  }

  function printInvoice(s: any, lineItems: any[]) {
    const w = window.open("", "_blank", "width=820,height=1000");
    if (!w) return;
    const inv = (profile?.invoice_settings ?? {}) as any;
    const biz = profile?.company_name || "";
    const owner = profile?.full_name || "";
    const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c] as string));
    const rows = lineItems.map((l, i) => `<tr>
      <td class="num">${i + 1}</td>
      <td>${esc(l.product_name)}</td>
      <td class="num">${lang === "bn" ? Number(l.qty).toLocaleString("bn-BD") : l.qty}</td>
      <td class="right">${fmtMoney(l.unit_price, lang)}</td>
      <td class="right">${fmtMoney(l.line_total, lang)}</td>
    </tr>`).join("");
    const dueBadge = Number(s.due) > 0
      ? `<span class="badge badge-due">${esc(t(Number(s.paid) > 0 ? "statusPartial" : "statusDue"))}</span>`
      : `<span class="badge badge-paid">${esc(t("statusPaid"))}</span>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.invoice_no)}</title>
      <style>
        @page{size:8in 6in landscape;margin:0.25in}
        *{box-sizing:border-box}
        html,body{width:8in}
        body{font-family:'Inter',system-ui,-apple-system,sans-serif;color:#0f172a;margin:0;padding:0.25in;background:#fff;font-size:11px}
        .sheet{width:100%;max-width:7.5in;margin:0 auto}
        .top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:10px;border-bottom:2px solid #0f172a}
        .brand{display:flex;gap:10px;align-items:center}
        .brand img{height:42px;width:42px;object-fit:contain;border-radius:6px;border:1px solid #e2e8f0;background:#fff}
        .brand .biz{font-size:16px;font-weight:700;letter-spacing:-0.01em}
        .brand .owner{font-size:10px;color:#64748b;margin-top:1px}
        .meta{text-align:right}
        .meta h1{font-size:18px;margin:0;letter-spacing:0.08em;color:#0f172a;font-weight:800}
        .meta .no{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#334155;margin-top:2px}
        .meta .date{font-size:10px;color:#64748b;margin-top:1px}
        .row{display:flex;justify-content:space-between;gap:12px;margin-top:10px}
        .card{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px}
        .card .lbl{font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;margin-bottom:2px}
        .card .val{font-size:12px;font-weight:600}
        .card .sub{font-size:10px;color:#64748b;margin-top:1px}
        table.items{width:100%;border-collapse:collapse;margin-top:10px;font-size:11px}
        table.items thead th{background:#0f172a;color:#fff;text-align:left;padding:5px 8px;font-weight:600;font-size:10px;letter-spacing:0.05em;text-transform:uppercase}
        table.items thead th.right{text-align:right}
        table.items tbody td{padding:5px 8px;border-bottom:1px solid #e2e8f0}
        table.items tbody tr:nth-child(even) td{background:#f8fafc}
        .right{text-align:right}.num{font-family:ui-monospace,Menlo,monospace}
        .totals{margin-top:8px;margin-left:auto;width:260px;font-size:11px}
        .totals .line{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed #e2e8f0}
        .totals .line.grand{border-top:2px solid #0f172a;border-bottom:2px solid #0f172a;margin-top:3px;padding:5px 0;font-size:13px;font-weight:700}
        .totals .line.paid{color:#16a34a}
        .totals .line.due{color:#dc2626;font-weight:600}
        .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;letter-spacing:0.04em}
        .badge-paid{background:#dcfce7;color:#15803d}
        .badge-due{background:#fee2e2;color:#b91c1c}
        .footer{margin-top:14px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:10px;color:#475569;display:grid;gap:6px}
        .footer h4{margin:0 0 2px;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#0f172a}
        .footer p{margin:0;white-space:pre-wrap;line-height:1.4}
        .thanks{margin-top:10px;text-align:center;font-size:11px;color:#0f172a;font-weight:600}
        @media print{body{padding:0.2in}.sheet{max-width:none}}
      </style></head><body><div class="sheet">
      <div class="top">
        <div class="brand">
          ${logoUrl ? `<img src="${esc(logoUrl)}" alt="">` : ""}
          <div>
            <div class="biz">${esc(biz || t("invoice"))}</div>
            ${owner ? `<div class="owner">${esc(owner)}</div>` : ""}
          </div>
        </div>
        <div class="meta">
          <h1>${esc(t("invoice")).toUpperCase()}</h1>
          <div class="no">${esc(s.invoice_no)}</div>
          <div class="date">${esc(fmtDateTime(s.created_at, lang))}</div>
          <div style="margin-top:6px">${dueBadge}</div>
        </div>
      </div>
      <div class="row">
        <div class="card">
          <div class="lbl">${esc(t("customer"))}</div>
          <div class="val">${esc(s.customers?.name ?? t("walkIn"))}</div>
          ${s.customers?.phone ? `<div class="sub">${esc(s.customers.phone)}</div>` : ""}
        </div>
        <div class="card">
          <div class="lbl">${esc(t("method"))}</div>
          <div class="val">${esc(methodLabel(s.payment_method))}</div>
        </div>
      </div>
      <table class="items">
        <thead><tr>
          <th style="width:32px">#</th>
          <th>${esc(t("item"))}</th>
          <th class="right" style="width:70px">${esc(t("qty"))}</th>
          <th class="right" style="width:110px">${esc(t("price"))}</th>
          <th class="right" style="width:130px">${esc(t("total"))}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div class="line"><span>${esc(t("subtotal"))}</span><span class="num">${fmtMoney(s.subtotal, lang)}</span></div>
        <div class="line"><span>${esc(t("discount"))}</span><span class="num">- ${fmtMoney(s.discount, lang)}</span></div>
        <div class="line"><span>${esc(t("tax"))}</span><span class="num">${fmtMoney(s.tax, lang)}</span></div>
        <div class="line grand"><span>${esc(t("total"))}</span><span class="num">${fmtMoney(s.total, lang)}</span></div>
        <div class="line paid"><span>${esc(t("paid"))}</span><span class="num">${fmtMoney(s.paid, lang)}</span></div>
        <div class="line due"><span>${esc(t("due"))}</span><span class="num">${fmtMoney(s.due, lang)}</span></div>
      </div>
      ${s.note ? `<div class="footer"><div><h4>${esc(t("note"))}</h4><p>${esc(s.note)}</p></div></div>` : ""}
      <div class="footer">
        ${inv.bankDetails ? `<div><h4>${esc(t("invoiceBankDetails"))}</h4><p>${esc(inv.bankDetails)}</p></div>` : ""}
        ${inv.paymentInstructions ? `<div><h4>${esc(t("invoicePaymentInstructions"))}</h4><p>${esc(inv.paymentInstructions)}</p></div>` : ""}
        ${inv.terms ? `<div><h4>${esc(t("invoiceTerms"))}</h4><p>${esc(inv.terms)}</p></div>` : ""}
        ${inv.notes ? `<div><h4>${esc(t("invoiceNotes"))}</h4><p>${esc(inv.notes)}</p></div>` : ""}
      </div>
      ${inv.footer ? `<div class="thanks">${esc(inv.footer)}</div>` : ""}
      </div><script>window.onload=()=>setTimeout(()=>window.print(),200)</script></body></html>`);
    w.document.close();
  }

  async function handlePrint(s: any) {
    const lines = await fetchSaleItems(s.id);
    printInvoice(s, lines);
  }


  const statusBadge = (s: any) => {
    if (Number(s.due) > 0) {
      return <Badge variant="outline" className="border-warning/40 text-warning">{Number(s.paid) > 0 ? t("statusPartial") : t("statusDue")}</Badge>;
    }
    return <Badge variant="outline" className="border-success/40 text-success">{t("statusPaid")}</Badge>;
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t("sales")}
        subtitle={t("salesSubtitle")}
        actions={
          <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-2" />{t("newSale")}</Button>
        }
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchSalesPlaceholder")} className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatus")}</SelectItem>
            <SelectItem value="paid">{t("statusPaid")}</SelectItem>
            <SelectItem value="due">{t("statusDue")}</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
        {(q || status !== "all" || from || to) && (
          <Button variant="ghost" onClick={() => { setQ(""); setStatus("all"); setFrom(""); setTo(""); }}>{t("clear")}</Button>
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
              {filtered.map((s: any) => (
                <tr key={s.id} className="border-t border-border/40 hover:bg-muted/30">
                  <td className="py-3 px-4 font-mono">{s.invoice_no}</td>
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{fmtDateTime(s.created_at, lang)}</td>
                  <td className="py-3 px-4">{s.customers?.name || <span className="text-muted-foreground">{t("walkIn")}</span>}</td>
                  <td className="py-3 px-4">{methodLabel(s.payment_method)}</td>
                  <td className="py-3 px-4">{statusBadge(s)}</td>
                  <td className="py-3 px-4 text-right font-mono">{fmtMoney(s.total, lang)}</td>
                  <td className="py-3 px-4 text-right font-mono text-success">{fmtMoney(s.paid, lang)}</td>
                  <td className="py-3 px-4 text-right font-mono">{Number(s.due) > 0 ? <span className="text-warning">{fmtMoney(s.due, lang)}</span> : "—"}</td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openView(s)} title={t("view")}><Eye className="h-4 w-4" /></Button>
                      {Number(s.due) > 0 && (
                        <Button size="icon" variant="ghost" onClick={() => { setPaySale(s); setPayAmount(String(s.due)); }} title={t("recordPayment")}><CreditCard className="h-4 w-4" /></Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => handlePrint(s)} title={t("print")}><Printer className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDelSale(s)} title={t("delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!viewSale} onOpenChange={(o) => !o && setViewSale(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("invoice")} {viewSale?.invoice_no}</DialogTitle>
          </DialogHeader>
          {viewSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-muted-foreground text-xs">{t("date")}</div>{fmtDate(viewSale.created_at, lang)}</div>
                <div><div className="text-muted-foreground text-xs">{t("customer")}</div>{viewSale.customers?.name ?? t("walkIn")}</div>
                <div><div className="text-muted-foreground text-xs">{t("method")}</div>{methodLabel(viewSale.payment_method)}</div>
                <div><div className="text-muted-foreground text-xs">{t("status")}</div>{statusBadge(viewSale)}</div>
              </div>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase">
                    <tr><th className="text-left p-2">{t("item")}</th><th className="text-right p-2">{t("qty")}</th><th className="text-right p-2">{t("price")}</th><th className="text-right p-2">{t("total")}</th></tr>
                  </thead>
                  <tbody>
                    {items === null && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">{t("loading")}</td></tr>}
                    {items?.map((i) => (
                      <tr key={i.id} className="border-t border-border/40">
                        <td className="p-2">{i.product_name}</td>
                        <td className="p-2 text-right font-mono">
                          {editing ? (
                            <Input type="number" step="0.01" value={i.qty} onChange={(e) => updateItem(i.id, { qty: Number(e.target.value) })} className="h-7 w-20 ml-auto text-right" />
                          ) : (lang === "bn" ? Number(i.qty).toLocaleString("bn-BD") : i.qty)}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {editing ? (
                            <Input type="number" step="0.01" value={i.unit_price} onChange={(e) => updateItem(i.id, { unit_price: Number(e.target.value) })} className="h-7 w-24 ml-auto text-right" />
                          ) : fmtMoney(i.unit_price, lang)}
                        </td>
                        <td className="p-2 text-right font-mono">{fmtMoney(i.line_total, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">{t("subtotal")}</div><div className="text-right font-mono">{fmtMoney(viewSale.subtotal, lang)}</div>
                <div className="text-muted-foreground">{t("discount")}</div><div className="text-right font-mono">{fmtMoney(viewSale.discount, lang)}</div>
                <div className="text-muted-foreground">{t("tax")}</div><div className="text-right font-mono">{fmtMoney(viewSale.tax, lang)}</div>
                <div className="font-medium">{t("total")}</div><div className="text-right font-mono font-medium">{fmtMoney(viewSale.total, lang)}</div>
                <div className="text-success">{t("paid")}</div><div className="text-right font-mono text-success">{fmtMoney(viewSale.paid, lang)}</div>
                <div className="text-warning">{t("due")}</div><div className="text-right font-mono text-warning">{fmtMoney(viewSale.due, lang)}</div>
              </div>
              {viewSale.note && <div className="text-sm"><span className="text-muted-foreground">{t("note")}: </span>{viewSale.note}</div>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => viewSale && items && printInvoice(viewSale, items)}><Printer className="h-4 w-4 mr-2" />{t("print")}</Button>
            {editing ? (
              <>
                <Button variant="ghost" onClick={async () => { setEditing(false); if (viewSale) setItems(await fetchSaleItems(viewSale.id)); }}>{t("cancel")}</Button>
                <Button onClick={saveEdits} disabled={saving}><SaveIcon className="h-4 w-4 mr-2" />{t("save")}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setEditing(true)} disabled={!items}><Pencil className="h-4 w-4 mr-2" />{t("edit")}</Button>
                <Button onClick={() => setViewSale(null)}>{t("close")}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paySale} onOpenChange={(o) => { if (!o) { setPaySale(null); setPayAmount(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("recordPayment")} · {paySale?.invoice_no}</DialogTitle>
          </DialogHeader>
          {paySale && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("total")}</span><span className="font-mono">{fmtMoney(paySale.total, lang)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("alreadyPaid")}</span><span className="font-mono text-success">{fmtMoney(paySale.paid, lang)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("outstanding")}</span><span className="font-mono text-warning">{fmtMoney(paySale.due, lang)}</span></div>
              <div>
                <label className="text-xs text-muted-foreground">{t("amountReceived")}</label>
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

      <AlertDialog open={!!delSale} onOpenChange={(o) => !o && setDelSale(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteSaleTitle")} {delSale?.invoice_no}?</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteSaleDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSale}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Sale */}
      <Dialog open={openNew} onOpenChange={(o) => { if (!o) { setOpenNew(false); resetNew(); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("newSale")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t("customer")}</label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder={t("selectCustomer")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walkin">{t("walkIn")}</SelectItem>
                    {(customersList as any[]).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("method")}</label>
                <Select value={newMethod} onValueChange={setNewMethod}>
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={t("selectProduct")}
                  className="pl-9"
                />
              </div>
              {(() => {
                const list = (productsList as any[]);
                if (list.length === 0) {
                  return <div className="mt-2 text-sm text-muted-foreground px-2">{t("noData")}</div>;
                }
                const q2 = productSearch.trim().toLowerCase();
                const filteredP = q2
                  ? list.filter((p) => `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(q2))
                  : list;
                return (
                  <div className="mt-2 max-h-56 overflow-y-auto border rounded-md divide-y">
                    {filteredP.slice(0, 50).map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => addLine(p.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-3"
                      >
                        <span className="truncate">{p.name}{p.sku ? ` · ${p.sku}` : ""}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{t("stock")}: {p.stock} · {fmtMoney(p.price, lang)}</span>
                      </button>
                    ))}
                    {filteredP.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">{t("noData")}</div>
                    )}
                  </div>
                );
              })()}
            </div>

            {lines.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase">
                    <tr>
                      <th className="text-left p-2">{t("product")}</th>
                      <th className="text-right p-2 w-24">{t("qty")}</th>
                      <th className="text-right p-2 w-32">{t("price")}</th>
                      <th className="text-right p-2 w-28">{t("total")}</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <tr key={idx} className="border-t border-border/40">
                        <td className="p-2">{l.name}</td>
                        <td className="p-2"><Input type="number" min="0" step="0.01" className="h-8 text-right" value={l.qty} onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })} /></td>
                        <td className="p-2"><Input type="number" min="0" step="0.01" className="h-8 text-right" value={l.unit_price} onChange={(e) => updateLine(idx, { unit_price: Number(e.target.value) })} /></td>
                        <td className="p-2 text-right font-mono">{fmtMoney(l.qty * l.unit_price, lang)}</td>
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
                <Input type="number" step="0.01" value={newDiscount} onChange={(e) => setNewDiscount(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("tax")}</label>
                <Input type="number" step="0.01" value={newTax} onChange={(e) => setNewTax(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("paid")}</label>
                <Input type="number" step="0.01" value={newPaid} onChange={(e) => setNewPaid(e.target.value)} placeholder={String(newTotal)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("note")}</label>
                <Input value={newNote} onChange={(e) => setNewNote(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm border-t pt-3">
              <div className="text-muted-foreground">{t("subtotal")}</div><div className="text-right font-mono">{fmtMoney(newSubtotal, lang)}</div>
              <div className="font-medium">{t("total")}</div><div className="text-right font-mono font-medium">{fmtMoney(newTotal, lang)}</div>
              <div className="text-success">{t("paid")}</div><div className="text-right font-mono text-success">{fmtMoney(newPaidAmt, lang)}</div>
              <div className="text-warning">{t("due")}</div><div className="text-right font-mono text-warning">{fmtMoney(newDue, lang)}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpenNew(false); resetNew(); }}>{t("cancel")}</Button>
            <Button onClick={createSale} disabled={creating}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
