import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtDateTime, fmtDate, fmtInvoiceDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/DateInput";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Eye, CreditCard, Printer, Trash2, Search, Plus, Pencil, Save as SaveIcon, X, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useInvoicePreview } from "@/components/InvoicePreviewProvider";
import { ProductFormDialog, type CreatedProduct } from "@/components/ProductFormDialog";



export const Route = createFileRoute("/_authenticated/sales")({
  validateSearch: (search: Record<string, unknown>) => ({
    new: search.new === 1 || search.new === "1" ? 1 : undefined,
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: ["sales"], queryFn: fetchSales });
  },
  component: SalesPage,
  errorComponent: ({ error }) => { console.error(error); return <div className="p-8 text-destructive">Something went wrong loading this page.</div>; },
  notFoundComponent: () => <div className="p-4 sm:p-6 lg:p-8">Not found</div>,
});

export async function fetchSales() {
  const { data, error } = await supabase
    .from("sales")
    .select("id,invoice_no,subtotal,discount,tax,total,paid,due,payment_method,status,note,created_at,customer_id,customers(name,phone,address)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

async function fetchSaleItems(saleId: string) {
  const { data, error } = await supabase
    .from("sale_items")
    .select("id,product_id,product_name,qty,unit_price,line_total")
    .eq("sale_id", saleId);
  if (error) throw error;
  return data ?? [];
}

let _companyNameCache: string | null = null;
async function getCompanyName(): Promise<string> {
  if (_companyNameCache !== null) return _companyNameCache;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return "";
  const { data } = await supabase.from("profiles").select("company_name").eq("id", u.user.id).single();
  _companyNameCache = data?.company_name ?? "";
  return _companyNameCache;
}

async function fireSmsAsync(opts: {
  customerId: string | null;
  phone: string | null | undefined;
  body: string;
  kind: "sale_receipt" | "payment_receipt";
}) {
  if (!opts.phone) return;
  try {
    const { sendSms } = await import("@/lib/sms.functions");
    await sendSms({
      data: {
        customerId: opts.customerId,
        phone: opts.phone,
        body: opts.body,
        kind: opts.kind,
      },
    });
    toast.success("SMS পাঠানো হয়েছে");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    toast.warning("SMS পাঠানো যায়নি: " + msg);
  }
}

function SalesPage() {
  const { t, lang } = useI18n();
  const { showInvoicePreview } = useInvoicePreview();

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
  const [payDate, setPayDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<any[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState<string>("");
  const [editCustomerId, setEditCustomerId] = useState<string>("");
  const [editMethod, setEditMethod] = useState<string>("cash");
  const [saving, setSaving] = useState(false);

  // New sale dialog state
  const [openNew, setOpenNew] = useState(false);
  const search = Route.useSearch();
  const navigate = useNavigate();
  useEffect(() => {
    if (search.new === 1) {
      setOpenNew(true);
      navigate({ to: "/sales", search: {}, replace: true });
    }
  }, [search.new, navigate]);
  const [customerId, setCustomerId] = useState<string>("walkin");
  const [newMethod, setNewMethod] = useState("cash");
  const [newDiscount, setNewDiscount] = useState("0");
  const [newTax, setNewTax] = useState("0");
  const [newDelivery, setNewDelivery] = useState("0");
  const [newPaid, setNewPaid] = useState<string>("");
  const [newNote, setNewNote] = useState("");
  const [newDate, setNewDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<{ product_id: string; name: string; qty: number; unit_price: number; cost_price: number; stock: number }[]>([]);
  const [creating, setCreating] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Inline new-customer dialog
  const [openNewCust, setOpenNewCust] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncAddress, setNcAddress] = useState("");
  const [ncSaving, setNcSaving] = useState(false);

  // Inline new-product dialog
  const [openNewProd, setOpenNewProd] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, company_name, currency, logo_url, address, phone, invoice_settings")
        .eq("id", u.user.id)
        .single();
      return data ? { ...data, email: u.user.email || null } : null;
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
      const { data, error } = await supabase.from("products").select("id,name,sku,sell_price,cost_price,stock,category_id").order("name");
      if (error) throw error;
      return (data ?? []).map((p: any) => ({ ...p, price: p.sell_price }));
    },
    enabled: openNew,
  });
  const { data: categoriesList = [] } = useQuery({
    queryKey: ["categories-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
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
  });

  const inv = (profile?.invoice_settings ?? {}) as any;
  const sett = {
    showInvoiceNumber: inv.showInvoiceNumber !== false,
    taxPerTx: inv.taxPerTx !== false,
    discountPerTx: inv.discountPerTx !== false,
    deliveryCharge: !!inv.deliveryCharge,
    dueSmsOnTx: inv.dueSmsOnTx !== false,
    allowViewInvoice: inv.allowViewInvoice !== false,
    autoIncrementInvoice: inv.autoIncrementInvoice !== false,
    startingInvoiceNumber: Number(inv.startingInvoiceNumber) || 1000,
    showPreviousDue: !!inv.showPreviousDue,
    cashSaleDefault: inv.cashSaleDefault !== false,
  };
  // Set default method to cash if cashSaleDefault is on (already cash by default)

  const newSubtotal = lines.reduce((a, l) => a + l.qty * l.unit_price, 0);
  const newTotal = Math.max(0, newSubtotal - Number(newDiscount || 0) + Number(newTax || 0) + Number(newDelivery || 0));
  const newPaidAmt = newPaid === "" ? newTotal : Number(newPaid);
  const newDue = Math.max(0, newTotal - newPaidAmt);

  async function createCustomerInline() {
    if (!ncName.trim()) return toast.error("নাম দিন");
    setNcSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("customers").insert({
        owner_id: u.user!.id,
        name: ncName.trim(),
        phone: ncPhone.trim() || null,
        address: ncAddress.trim() || null,
      }).select("id,name,phone").single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["customers-list"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setCustomerId(data.id);
      setOpenNewCust(false);
      setNcName(""); setNcPhone(""); setNcAddress("");
      toast.success("ক্রেতা যুক্ত হয়েছে");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setNcSaving(false);
    }
  }


  function addLine(productId: string) {
    const p = (productsList as any[]).find((x) => x.id === productId);
    setProductSearch("");
    if (!p) return;
    if (lines.some((l) => l.product_id === productId)) {
      setLines((ls) => ls.map((l) => l.product_id === productId ? { ...l, qty: l.qty + 1 } : l));
      return;
    }
    setLines((ls) => [...ls, { product_id: p.id, name: p.name, qty: 1, unit_price: Number(p.price || 0), cost_price: Number(p.cost_price || 0), stock: Number(p.stock || 0) }]);
  }
  function updateLine(idx: number, patch: Partial<{ qty: number; unit_price: number }>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLine(idx: number) {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  }
  function resetNew() {
    setCustomerId("walkin"); setNewMethod("cash"); setNewDiscount("0"); setNewTax("0"); setNewDelivery("0"); setNewPaid(""); setNewNote(""); setLines([]); setNewDate(new Date().toISOString().slice(0, 10));
  }

  async function createSale() {
    if (lines.length === 0) return toast.error(t("cartEmpty"));
    for (const l of lines) {
      if (l.qty > l.stock) return toast.error(`${l.name}: ${t("insufficientStock")}`);
    }
    setCreating(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      // Generate invoice number — auto-increment if enabled
      let invoice_no = "INV-" + Date.now().toString().slice(-8);
      if (sett.autoIncrementInvoice) {
        const { data: last } = await supabase
          .from("sales")
          .select("invoice_no")
          .eq("owner_id", u.user!.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const m = last?.invoice_no?.match(/(\d+)\s*$/);
        const next = m ? Number(m[1]) + 1 : sett.startingInvoiceNumber;
        invoice_no = "INV-" + String(next).padStart(4, "0");
      }
      const status = newDue <= 0 ? "paid" : newPaidAmt > 0 ? "partial" : "due";
      const noteWithDelivery = sett.deliveryCharge && Number(newDelivery) > 0
        ? `${newNote ? newNote + " | " : ""}Delivery: ${newDelivery}`
        : newNote;
      let saleCreatedAt: string | undefined;
      if (newDate) {
        const now = new Date();
        const d = new Date(newDate + "T00:00:00");
        d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        saleCreatedAt = d.toISOString();
      }
      const { data: sale, error } = await supabase.from("sales").insert({
        owner_id: u.user!.id,
        customer_id: customerId === "walkin" ? null : customerId,
        invoice_no,
        subtotal: newSubtotal,
        discount: Number(newDiscount || 0),
        tax: Number(newTax || 0) + Number(newDelivery || 0),
        total: newTotal,
        paid: newPaidAmt,
        due: newDue,
        payment_method: newMethod,
        status,
        note: noteWithDelivery || null,
        ...(saleCreatedAt ? { created_at: saleCreatedAt } : {}),
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

      // Fire-and-forget SMS receipt — gated by dueSmsOnTx setting
      if (sett.dueSmsOnTx && customerId !== "walkin") {
        const cust = customersList.find((c: any) => c.id === customerId);
        if (cust?.phone) {
          const company = await getCompanyName();
          const dueLine = newDue > 0 ? ` বাকি: ৳${newDue.toFixed(2)}।` : "";
          const body = `প্রিয় ${cust.name}, ${invoice_no} — মোট: ৳${newTotal.toFixed(2)}, পরিশোধ: ৳${newPaidAmt.toFixed(2)}।${dueLine} ধন্যবাদ${company ? " — " + company : ""}`;
          void fireSmsAsync({ customerId: cust.id, phone: cust.phone, body, kind: "sale_receipt" });
        }
      }
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
    setEditDate(s.created_at ? new Date(s.created_at).toISOString().slice(0, 10) : "");
    setEditCustomerId(s.customer_id ?? "");
    setEditMethod(s.payment_method ?? "cash");
    const list = await fetchSaleItems(s.id);
    setItems(list);
  }

  function updateItem(id: string, patch: { qty?: number; unit_price?: number; product_id?: string | null; product_name?: string }) {
    setItems((prev) => prev?.map((i) => {
      if (i.id !== id) return i;
      const next = { ...i, ...patch };
      next.line_total = Number(next.qty || 0) * Number(next.unit_price || 0);
      return next;
    }) ?? null);
  }

  const [productPickerOpen, setProductPickerOpen] = useState<string | null>(null);

  async function saveEdits() {
    if (!viewSale || !items) return;
    setSaving(true);
    try {
      for (const i of items) {
        const { error } = await supabase
          .from("sale_items")
          .update({ qty: Number(i.qty), unit_price: Number(i.unit_price), line_total: Number(i.qty) * Number(i.unit_price), product_id: i.product_id ?? null, product_name: i.product_name })
          .eq("id", i.id);
        if (error) throw error;
      }
      const subtotal = items.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
      const discount = Number(viewSale.discount || 0);
      const tax = Number(viewSale.tax || 0);
      const total = Math.max(0, subtotal - discount + tax);
      const paid = Number(viewSale.paid || 0);
      const due = Math.max(0, total - paid);
      const newCreatedAt = editDate
        ? (() => {
            const orig = viewSale.created_at ? new Date(viewSale.created_at) : new Date();
            const [y, m, d] = editDate.split("-").map(Number);
            const dt = new Date(orig);
            dt.setFullYear(y, (m || 1) - 1, d || 1);
            return dt.toISOString();
          })()
        : viewSale.created_at;
      const { error: e2 } = await supabase
        .from("sales")
        .update({ subtotal, total, due, status: due <= 0 ? "paid" : paid > 0 ? "partial" : "due", created_at: newCreatedAt, payment_method: editMethod })
        .eq("id", viewSale.id);
      if (e2) throw e2;
      let updatedCustomers = viewSale.customers;
      let updatedCustomerId = viewSale.customer_id;
      const newCustId = editCustomerId || null;
      if (newCustId !== viewSale.customer_id) {
        const { error: e3 } = await supabase
          .from("sales")
          .update({ customer_id: newCustId })
          .eq("id", viewSale.id);
        if (e3) throw e3;
        updatedCustomerId = newCustId;
        if (newCustId) {
          const c = (customersList as any[]).find((x) => x.id === newCustId);
          updatedCustomers = c ? { name: c.name, phone: c.phone, address: (c as any).address ?? "" } : null;
        } else {
          updatedCustomers = null;
        }
      }
      toast.success(t("save"));
      setEditing(false);
      setViewSale({ ...viewSale, subtotal, total, due, created_at: newCreatedAt, payment_method: editMethod, customer_id: updatedCustomerId, customers: updatedCustomers });
      qc.invalidateQueries({ queryKey: ["sales"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function recordPayment(opts?: { print?: boolean }) {
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
    // Fire-and-forget payment confirmation SMS
    const phone = paySale?.customers?.phone as string | undefined;
    const custName = (paySale?.customers?.name as string | undefined) ?? "গ্রাহক";
    if (phone && paySale.customer_id) {
      const company = await getCompanyName();
      const dueLine = newDue > 0 ? ` অবশিষ্ট বাকি: ৳${newDue.toFixed(2)}।` : " সম্পূর্ণ পরিশোধিত।";
      const body = `প্রিয় ${custName}, ${paySale.invoice_no} এর জন্য ৳${amt.toFixed(2)} পরিশোধ পাওয়া গেছে।${dueLine} ধন্যবাদ${company ? " — " + company : ""}`;
      void fireSmsAsync({ customerId: paySale.customer_id, phone, body, kind: "payment_receipt" });
    }
    if (opts?.print) {
      printPaymentReceipt(paySale, amt, newPaid, newDue, payDate);
    }
    setPaySale(null);
    setPayAmount("");
    setPayDate(new Date().toISOString().slice(0, 10));
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
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
    showInvoicePreview({
      doc: {
        invoice_no: s.invoice_no,
        created_at: s.created_at,
        partyName: s.customers?.name ?? t("walkIn"),
        partyPhone: s.customers?.phone ?? "",
        method: s.customers?.address ?? "",
        note: s.note ?? "",
        subtotal: s.subtotal,
        total: s.total,
        paid: s.paid,
        due: s.due,
        items: lineItems.map((l) => ({
          name: l.product_name,
          qty: l.qty,
          price: l.unit_price,
          total: l.line_total,
        })),
        discount: s.discount,
        tax: s.tax,
      },
      business: {
        name: profile?.company_name || "",
        owner: profile?.full_name || "",
        address: profile?.address || "",
        phone: profile?.phone || null,
        email: (profile as any)?.email || null,
        logoUrl: logoUrl || null,
      },
      settings: profile?.invoice_settings ?? {},
      lang: lang as "bn" | "en",
      labels: {
        invoice: t("invoice"),
        date: t("date"),
        customer: t("customerName"),
        phone: t("phone"),
        method: lang === "bn" ? "ঠিকানা:" : "Address:",
        item: t("item"),
        price: t("price"),
        qty: t("qty"),
        total: t("total"),
        subtotal: t("subtotal"),
        paid: t("paid"),
        due: t("due"),
        note: t("note"),
        statusPaid: t("statusPaid"),
        statusDue: t("statusDue"),
        statusPartial: t("statusPartial"),
        bankDetails: t("invoiceBankDetails"),
        paymentInstructions: t("invoicePaymentInstructions"),
        terms: t("invoiceTerms"),
        notes: t("invoiceNotes"),
        discount: lang === "bn" ? "ডিসকাউন্ট" : "Discount",
        tax: lang === "bn" ? "ট্যাক্স" : "Tax",
        deliveryCharge: lang === "bn" ? "ডেলিভারি চার্জ" : "Delivery",
        signature: lang === "bn" ? "স্বাক্ষর" : "Signature",
      },
    });
  }

  async function handlePrint(s: any) {
    const lines = await fetchSaleItems(s.id);
    printInvoice(s, lines);
  }

  function printPaymentReceipt(s: any, amount: number, newPaid: number, newDue: number, dateStr?: string) {
    const isBn = lang === "bn";
    const receiptCreatedAt = (() => {
      if (!dateStr) return new Date().toISOString();
      const now = new Date();
      const d = new Date(dateStr + "T00:00:00");
      d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      return d.toISOString();
    })();
    showInvoicePreview({
      doc: {
        invoice_no: (isBn ? "পরিশোধ • " : "PAY • ") + s.invoice_no,
        created_at: receiptCreatedAt,
        partyName: s.customers?.name ?? t("walkIn"),
        partyPhone: s.customers?.phone ?? "",
        method: s.customers?.address ?? "",
        note: isBn
          ? `ইনভয়েস ${s.invoice_no} এর বাকি পরিশোধের রসিদ`
          : `Payment receipt for invoice ${s.invoice_no}`,
        subtotal: amount,
        total: amount,
        paid: newPaid,
        due: newDue,
        items: [
          {
            name: isBn ? `বাকি পরিশোধ — ${s.invoice_no}` : `Due payment — ${s.invoice_no}`,
            qty: 1,
            price: amount,
            total: amount,
          },
        ],
      },
      business: {
        name: profile?.company_name || "",
        owner: profile?.full_name || "",
        address: profile?.address || "",
        phone: profile?.phone || null,
        email: (profile as any)?.email || null,
        logoUrl: logoUrl || null,
      },
      settings: profile?.invoice_settings ?? {},
      lang: lang as "bn" | "en",
      labels: {
        invoice: isBn ? "পরিশোধ রসিদ" : "Payment Receipt",
        date: t("date"),
        customer: t("customerName"),
        phone: t("phone"),
        method: isBn ? "ঠিকানা:" : "Address:",
        item: isBn ? "বিবরণ" : "Description",
        price: isBn ? "পরিমাণ" : "Amount",
        qty: t("qty"),
        total: t("total"),
        subtotal: isBn ? "পরিশোধিত" : "Received",
        paid: isBn ? "মোট পরিশোধিত" : "Total Paid",
        due: isBn ? "অবশিষ্ট বাকি" : "Remaining Due",
        note: t("note"),
        statusPaid: t("statusPaid"),
        statusDue: t("statusDue"),
        statusPartial: t("statusPartial"),
        bankDetails: t("invoiceBankDetails"),
        paymentInstructions: t("invoicePaymentInstructions"),
        terms: t("invoiceTerms"),
        notes: t("invoiceNotes"),
        signature: isBn ? "স্বাক্ষর" : "Signature",
      },
      hideMethod: false,
    });
  }



  const statusBadge = (s: any) => {
    if (Number(s.due) > 0) {
      return <Badge variant="outline" className="border-warning/40 text-warning">{Number(s.paid) > 0 ? t("statusPartial") : t("statusDue")}</Badge>;
    }
    return <Badge variant="outline" className="border-success/40 text-success">{t("statusPaid")}</Badge>;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
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
                {sett.showInvoiceNumber && <th className="py-3 px-4">{t("invoice")}</th>}
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
                <tr><td colSpan={sett.showInvoiceNumber ? 9 : 8} className="py-10 text-center text-muted-foreground">{t("noData")}</td></tr>
              )}
              {filtered.map((s: any) => (
                <tr key={s.id} className="border-t border-border/40 hover:bg-muted/30">
                  {sett.showInvoiceNumber && <td className="py-3 px-4 font-mono">{s.invoice_no}</td>}
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{fmtDateTime(s.created_at, lang)}</td>
                  <td className="py-3 px-4">{s.customers?.name || <span className="text-muted-foreground">{t("walkIn")}</span>}</td>
                  <td className="py-3 px-4">{methodLabel(s.payment_method)}</td>
                  <td className="py-3 px-4">{statusBadge(s)}</td>
                  <td className="py-3 px-4 text-right font-mono">{fmtMoney(s.total, lang)}</td>
                  <td className="py-3 px-4 text-right font-mono text-success">{fmtMoney(s.paid, lang)}</td>
                  <td className="py-3 px-4 text-right font-mono">{Number(s.due) > 0 ? <span className="text-warning">{fmtMoney(s.due, lang)}</span> : "—"}</td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      {sett.allowViewInvoice && (
                        <Button size="icon" variant="ghost" onClick={() => openView(s)} title={t("view")} aria-label={t("view")}><Eye className="h-4 w-4" /></Button>
                      )}
                      {Number(s.due) > 0 && (
                        <Button size="icon" variant="ghost" onClick={() => { setPaySale(s); setPayAmount(String(s.due)); setPayDate(new Date().toISOString().slice(0, 10)); }} title={t("recordPayment")} aria-label={t("recordPayment")}><CreditCard className="h-4 w-4" /></Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => handlePrint(s)} title={t("print")} aria-label={t("print")}><Printer className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDelSale(s)} title={t("delete")} aria-label={t("delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
        {filtered.map((s: any) => (
          <div key={s.id} className="card-premium p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-sm font-medium truncate">{s.invoice_no}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(s.created_at, lang)}</div>
              </div>
              {statusBadge(s)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="min-w-0">
                <div className="text-muted-foreground">{t("customer")}</div>
                <div className="truncate">{s.customers?.name || t("walkIn")}</div>
              </div>
              <div className="min-w-0">
                <div className="text-muted-foreground">{t("method")}</div>
                <div className="truncate">{methodLabel(s.payment_method)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("total")}</div>
                <div className="font-mono font-medium">{fmtMoney(s.total, lang)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("due")}</div>
                <div className={`font-mono ${Number(s.due) > 0 ? "text-warning" : ""}`}>{Number(s.due) > 0 ? fmtMoney(s.due, lang) : "—"}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 border-t">
              {sett.allowViewInvoice && (
                <Button size="sm" variant="ghost" className="min-h-11 flex-1" onClick={() => openView(s)}><Eye className="h-4 w-4 mr-1" />{t("view")}</Button>
              )}
              {Number(s.due) > 0 && (
                <Button size="sm" variant="ghost" className="min-h-11 flex-1" onClick={() => { setPaySale(s); setPayAmount(String(s.due)); setPayDate(new Date().toISOString().slice(0, 10)); }}><CreditCard className="h-4 w-4 mr-1" />{t("recordPayment")}</Button>
              )}
              <Button size="sm" variant="ghost" className="min-h-11" onClick={() => handlePrint(s)} aria-label={t("print")}><Printer className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setDelSale(s)} aria-label={t("delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>


      <Dialog open={!!viewSale} onOpenChange={(o) => !o && setViewSale(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("invoice")} {viewSale?.invoice_no}</DialogTitle>
          </DialogHeader>
          {viewSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-muted-foreground text-xs">{t("date")}</div>{editing ? <DateInput value={editDate} onChange={setEditDate} clearable={false} className="h-8" /> : fmtDate(viewSale.created_at, lang)}</div>
                <div><div className="text-muted-foreground text-xs">{t("customer")}</div>{editing ? (() => {
                  const selected = (customersList as any[]).find((c) => c.id === editCustomerId);
                  const label = selected ? `${selected.name}${selected.phone ? ` — ${selected.phone}` : ""}` : t("walkIn");
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="h-8 w-full justify-between font-normal">
                          <span className="truncate">{label}</span>
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-2" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                        <Command>
                          <CommandInput placeholder={t("search") || "Search..."} />
                          <CommandList>
                            <CommandEmpty>—</CommandEmpty>
                            <CommandGroup>
                              <CommandItem value="__walkin__" onSelect={() => setEditCustomerId("")}>
                                <Check className={cn("mr-2 h-4 w-4", !editCustomerId ? "opacity-100" : "opacity-0")} />
                                {t("walkIn")}
                              </CommandItem>
                              {(customersList as any[]).map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={`${c.name} ${c.phone ?? ""}`}
                                  onSelect={() => setEditCustomerId(c.id)}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", editCustomerId === c.id ? "opacity-100" : "opacity-0")} />
                                  <span className="truncate">{c.name}{c.phone ? ` — ${c.phone}` : ""}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  );
                })() : (viewSale.customers?.name ?? t("walkIn"))}</div>
                <div><div className="text-muted-foreground text-xs">{t("method")}</div>{editing ? (
                  <Select value={editMethod} onValueChange={setEditMethod}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t("methodCash")}</SelectItem>
                      <SelectItem value="card">{t("methodCard")}</SelectItem>
                      <SelectItem value="mobile">{t("methodMobile")}</SelectItem>
                      <SelectItem value="bank">{t("methodBank")}</SelectItem>
                      <SelectItem value="due">{t("methodDue")}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : methodLabel(viewSale.payment_method)}</div>
                <div><div className="text-muted-foreground text-xs">{t("status")}</div>{statusBadge(viewSale)}</div>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase">
                    <tr><th className="text-left p-2">{t("item")}</th><th className="text-right p-2">{t("price")}</th><th className="text-right p-2">{t("qty")}</th><th className="text-right p-2">{t("total")}</th></tr>
                  </thead>
                  <tbody>
                    {items === null && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">{t("loading")}</td></tr>}
                    {items?.map((i) => (
                      <tr key={i.id} className="border-t border-border/40">
                        <td className="p-2">
                          {editing ? (
                            <Popover open={productPickerOpen === i.id} onOpenChange={(o) => setProductPickerOpen(o ? i.id : null)}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="h-8 w-full justify-between font-normal">
                                  <span className="truncate">{i.product_name || t("product")}</span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="p-0 w-[260px]" align="start">
                                <Command>
                                  <CommandInput placeholder={t("search") + "..."} />
                                  <CommandList>
                                    <CommandEmpty>—</CommandEmpty>
                                    <CommandGroup>
                                      {(productsList as any[]).map((p) => (
                                        <CommandItem key={p.id} value={`${p.name} ${p.sku ?? ""}`} onSelect={() => {
                                          updateItem(i.id, { product_id: p.id, product_name: p.name, unit_price: Number(p.sell_price || i.unit_price) });
                                          setProductPickerOpen(null);
                                        }}>
                                          <Check className={cn("mr-2 h-4 w-4", i.product_id === p.id ? "opacity-100" : "opacity-0")} />
                                          <span className="truncate">{p.name}</span>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          ) : i.product_name}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {editing ? (
                            <Input type="number" step="0.01" value={i.unit_price} onChange={(e) => updateItem(i.id, { unit_price: Number(e.target.value) })} className="h-7 w-24 ml-auto text-right" />
                          ) : fmtMoney(i.unit_price, lang)}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {editing ? (
                            <Input type="number" step="0.01" value={i.qty} onChange={(e) => updateItem(i.id, { qty: Number(e.target.value) })} className="h-7 w-20 ml-auto text-right" />
                          ) : (lang === "bn" ? Number(i.qty).toLocaleString("bn-BD") : i.qty)}
                        </td>
                        <td className="p-2 text-right font-mono">{fmtMoney(i.line_total, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">{t("subtotal")}</div><div className="text-right font-mono">{fmtMoney(viewSale.subtotal, lang)}</div>
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

      <Dialog open={!!paySale} onOpenChange={(o) => { if (!o) { setPaySale(null); setPayAmount(""); setPayDate(new Date().toISOString().slice(0, 10)); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("recordPayment")} · {paySale?.invoice_no}</DialogTitle>
          </DialogHeader>
          {paySale && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("total")}</span><span className="font-mono">{fmtMoney(paySale.total, lang)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("alreadyPaid")}</span><span className="font-mono text-success">{fmtMoney(paySale.paid, lang)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("outstanding")}</span><span className="font-mono text-warning">{fmtMoney(paySale.due, lang)}</span></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">{t("date")}</label>
                  <DateInput value={payDate} onChange={setPayDate} clearable={false} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("amountReceived")}</label>
                  <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => { setPaySale(null); setPayAmount(""); setPayDate(new Date().toISOString().slice(0, 10)); }}>{t("cancel")}</Button>
            <Button variant="outline" onClick={() => recordPayment({ print: true })}><Printer className="h-4 w-4 mr-2" />{lang === "bn" ? "সেভ ও প্রিন্ট" : "Save & Print"}</Button>
            <Button onClick={() => recordPayment()}>{t("save")}</Button>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("newSale")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t("customer")}</label>
                <Select value={customerId} onValueChange={(v) => { if (v === "__new__") { setOpenNewCust(true); } else { setCustomerId(v); } }}>
                  <SelectTrigger><SelectValue placeholder={t("selectCustomer")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walkin">{t("walkIn")}</SelectItem>
                    <SelectItem value="__new__">+ নতুন ক্রেতা যুক্ত করুন</SelectItem>
                    {(customersList as any[]).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("date")}</label>
                <DateInput value={newDate} onChange={setNewDate} clearable={false} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("method")}</label>
                <Select value={newMethod} onValueChange={(v) => { setNewMethod(v); if (v === "due") setNewPaid("0"); else if (newPaid === "0") setNewPaid(""); }}>
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
              <div className="grid grid-cols-[180px_1fr_auto] gap-2 items-end">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger><SelectValue placeholder="ক্যাটাগরি" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সব ক্যাটাগরি</SelectItem>
                    <SelectItem value="__none__">— ক্যাটাগরিহীন —</SelectItem>
                    {(categoriesList as any[]).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder={t("selectProduct")}
                    className="pl-9"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setOpenNewProd(true)}><Plus className="h-3.5 w-3.5 mr-1" />{lang === "bn" ? "নতুন পণ্য" : "New Product"}</Button>
              </div>
              {(() => {
                const list = (productsList as any[]);
                if (list.length === 0) {
                  return <div className="mt-2 text-sm text-muted-foreground px-2">{t("noData")}</div>;
                }
                const q2 = productSearch.trim().toLowerCase();
                let filteredP = list;
                if (categoryFilter === "__none__") filteredP = filteredP.filter((p) => !p.category_id);
                else if (categoryFilter !== "all") filteredP = filteredP.filter((p) => p.category_id === categoryFilter);
                if (q2) filteredP = filteredP.filter((p) => `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(q2));
                return (
                  <div className="mt-2 max-h-56 overflow-y-auto thin-scrollbar border rounded-md divide-y">
                    {filteredP.slice(0, 50).map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => addLine(p.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-3"
                      >
                        <span className="truncate">{p.name}{p.sku ? ` · ${p.sku}` : ""}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{t("stock")}: {p.stock} · {t("cost")}: {fmtMoney(p.cost_price, lang)} · {fmtMoney(p.price, lang)}</span>
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
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase">
                    <tr>
                      <th className="text-left p-2">{t("product")}</th>
                      <th className="text-right p-2 w-24">{t("qty")}</th>
                      <th className="text-right p-2 w-28">{t("cost")}</th>
                      <th className="text-right p-2 w-28">{t("price")}</th>
                      <th className="text-right p-2 w-28">{t("total")}</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <tr key={idx} className="border-t border-border/40">
                        <td className="p-2">{l.name}</td>
                        <td className="p-2"><Input type="number" min="0" step="0.01" className="h-8 text-right" value={l.qty} onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })} /></td>
                        <td className="p-2 text-right font-mono text-muted-foreground">{fmtMoney(l.cost_price, lang)}</td>
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
              {sett.discountPerTx && (
                <div>
                  <label className="text-xs text-muted-foreground">{t("discount")}</label>
                  <Input type="number" step="0.01" value={newDiscount} onChange={(e) => setNewDiscount(e.target.value)} />
                </div>
              )}
              {sett.taxPerTx && (
                <div>
                  <label className="text-xs text-muted-foreground">{t("tax")}</label>
                  <Input type="number" step="0.01" value={newTax} onChange={(e) => setNewTax(e.target.value)} />
                </div>
              )}
              {sett.deliveryCharge && (
                <div>
                  <label className="text-xs text-muted-foreground">{lang === "bn" ? "ডেলিভারি চার্জ" : "Delivery charge"}</label>
                  <Input type="number" step="0.01" value={newDelivery} onChange={(e) => setNewDelivery(e.target.value)} />
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">{t("paid")}</label>
                <Input
                  type="number"
                  step="0.01"
                  value={newPaid}
                  onChange={(e) => setNewPaid(e.target.value)}
                  placeholder={String(newTotal)}
                />
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

      {/* Inline New Customer */}
      <Dialog open={openNewCust} onOpenChange={(o) => { if (!o) { setOpenNewCust(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>নতুন ক্রেতা যুক্ত করুন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">নাম *</label>
              <Input value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="ক্রেতার নাম" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ফোন</label>
              <Input value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} placeholder="01XXXXXXXXX" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ঠিকানা</label>
              <Input value={ncAddress} onChange={(e) => setNcAddress(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNewCust(false)}>{t("cancel")}</Button>
            <Button onClick={createCustomerInline} disabled={ncSaving}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline New Product (full form) */}
      <ProductFormDialog
        open={openNewProd}
        onOpenChange={setOpenNewProd}
        onCreated={(p: CreatedProduct) => {
          setLines((ls) => [...ls, { product_id: p.id, name: p.name, qty: 1, unit_price: Number(p.sell_price || 0), cost_price: Number(p.cost_price || 0), stock: Number(p.stock || 0) }]);
        }}
      />
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
