import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtDate } from "@/lib/format";
import { resolveBranchIdForInsert } from "@/lib/current-branch";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/DateInput";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Search, Plus, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/expenses")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: ["expenses"], queryFn: fetchExpenses });
  },
  component: ExpensesPage,
  errorComponent: ({ error }) => { console.error(error); return <div className="p-8 text-destructive">Something went wrong loading this page.</div>; },
  notFoundComponent: () => <div className="p-4 sm:p-6 lg:p-8">Not found</div>,
});

async function fetchExpenses() {
  const [exp, sales] = await Promise.all([
    (supabase as any)
      .from("expenses")
      .select("id,expense_date,description,amount,paid_amount,method,note,party_name,party_type,due_date,created_at")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
    (supabase as any)
      .from("sales")
      .select("id,invoice_no,total,paid,due,payment_method,created_at,customer_id,customers(name)")
      .gt("due", 0)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (exp.error) throw exp.error;
  if (sales.error) throw sales.error;
  const expRows: DueRow[] = (exp.data ?? []).map((r: any) => ({ ...r, source: "expense" }));
  const saleRows: DueRow[] = (sales.data ?? []).map((s: any) => ({
    id: `sale:${s.id}`,
    source: "sale",
    sale_id: s.id,
    customer_id: s.customer_id,
    expense_date: (s.created_at as string).slice(0, 10),
    description: `বিক্রয় #${s.invoice_no}`,
    amount: Number(s.total || 0),
    paid_amount: Number(s.paid || 0),
    method: s.payment_method || "cash",
    note: null,
    party_name: s.customers?.name || "Walk-in",
    party_type: "customer",
    due_date: null,
    created_at: s.created_at,
  }));
  return [...saleRows, ...expRows];
}

type DueRow = {
  id: string;
  source?: "expense" | "sale";
  sale_id?: string;
  customer_id?: string | null;
  expense_date: string;
  description: string;
  amount: number;
  paid_amount: number;
  method: string;
  note: string | null;
  party_name: string;
  party_type: string;
  due_date: string | null;
  created_at: string;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function statusOf(r: DueRow): "settled" | "partial" | "open" {
  const a = Number(r.amount || 0);
  const p = Number(r.paid_amount || 0);
  if (p >= a && a > 0) return "settled";
  if (p > 0) return "partial";
  return "open";
}

function ExpensesPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: ["expenses"], queryFn: fetchExpenses });

  const [q, setQ] = useState("");
  const [pType, setPType] = useState("all");
  const [pStatus, setPStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [openForm, setOpenForm] = useState(false);
  const [edit, setEdit] = useState<DueRow | null>(null);
  const [del, setDel] = useState<DueRow | null>(null);
  const [payFor, setPayFor] = useState<DueRow | null>(null);
  const [payAmt, setPayAmt] = useState("");

  const [fDate, setFDate] = useState(todayStr());
  const [fDueDate, setFDueDate] = useState("");
  const [fParty, setFParty] = useState("");
  const [fPartyType, setFPartyType] = useState("customer");
  const [fDesc, setFDesc] = useState("");
  const [fAmt, setFAmt] = useState("");
  const [fPaid, setFPaid] = useState("");
  const [fMethod, setFMethod] = useState("cash");
  const [fNote, setFNote] = useState("");

  const methodLabel = (m: string) => {
    const key = `method${m ? m.charAt(0).toUpperCase() + m.slice(1) : ""}` as any;
    const v = (t as any)(key);
    return v && v !== key ? v : m;
  };

  const filtered = useMemo(() => (data as DueRow[]).filter((e) => {
    if (q) {
      const hay = `${e.party_name ?? ""} ${e.description ?? ""} ${e.note ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    if (pType !== "all" && e.party_type !== pType) return false;
    if (pStatus !== "all" && statusOf(e) !== pStatus) return false;
    if (from && e.expense_date < from) return false;
    if (to && e.expense_date > to) return false;
    return true;
  }), [data, q, pType, pStatus, from, to]);

  const stats = useMemo(() => {
    const rows = filtered;
    let receivable = 0, payable = 0, settled = 0;
    for (const r of rows) {
      const remaining = Math.max(0, Number(r.amount || 0) - Number(r.paid_amount || 0));
      if (statusOf(r) === "settled") settled += Number(r.amount || 0);
      if (r.party_type === "customer") receivable += remaining;
      else if (r.party_type === "supplier") payable += remaining;
    }
    return { count: rows.length, receivable, payable, settled };
  }, [filtered]);

  function resetForm() {
    setEdit(null);
    setFDate(todayStr());
    setFDueDate("");
    setFParty("");
    setFPartyType("customer");
    setFDesc("");
    setFAmt("");
    setFPaid("");
    setFMethod("cash");
    setFNote("");
  }

  function openEdit(e: DueRow) {
    setEdit(e);
    setFDate(e.expense_date);
    setFDueDate(e.due_date ?? "");
    setFParty(e.party_name ?? "");
    setFPartyType(e.party_type || "customer");
    setFDesc(e.description);
    setFAmt(String(e.amount));
    setFPaid(String(e.paid_amount || 0));
    setFMethod(e.method);
    setFNote(e.note ?? "");
    setOpenForm(true);
  }

  async function save() {
    const amount = Number(fAmt);
    const paid = Number(fPaid || 0);
    if (!fParty.trim()) return toast.error(t("partyName") + " *");
    if (!fDesc.trim()) return toast.error(t("description") + " *");
    if (!amount || amount <= 0) return toast.error(t("enterValidAmount"));
    if (paid < 0 || paid > amount) return toast.error(t("amountExceedsDue"));
    const payload = {
      expense_date: fDate || todayStr(),
      due_date: fDueDate || null,
      party_name: fParty.trim(),
      party_type: fPartyType,
      description: fDesc.trim(),
      amount,
      paid_amount: paid,
      method: fMethod,
      note: fNote.trim() || null,
    };
    if (edit) {
      const { error } = await (supabase as any).from("expenses").update(payload).eq("id", edit.id);
      if (error) return toast.error(error.message);
      toast.success(t("expenseUpdated"));
    } else {
      const { data: u } = await supabase.auth.getUser();
      const branch_id = await resolveBranchIdForInsert();
      const { error } = await (supabase as any).from("expenses").insert({ ...payload, owner_id: u.user!.id, branch_id });
      if (error) return toast.error(error.message);
      toast.success(t("expenseCreated"));
    }
    setOpenForm(false);
    resetForm();
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  async function doDelete() {
    if (!del) return;
    const { error } = await (supabase as any).from("expenses").delete().eq("id", del.id);
    if (error) return toast.error(error.message);
    toast.success(t("expenseDeleted"));
    setDel(null);
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  async function recordPayment() {
    if (!payFor) return;
    const add = Number(payAmt);
    const remaining = Number(payFor.amount) - Number(payFor.paid_amount || 0);
    if (!add || add <= 0) return toast.error(t("enterValidAmount"));
    if (add > remaining) return toast.error(t("amountExceedsDue"));
    if (payFor.source === "sale" && payFor.sale_id) {
      const newPaid = Number(payFor.paid_amount || 0) + add;
      const newDue = Math.max(0, Number(payFor.amount) - newPaid);
      const { error } = await (supabase as any)
        .from("sales")
        .update({ paid: newPaid, due: newDue, status: newDue <= 0 ? "paid" : "partial" })
        .eq("id", payFor.sale_id);
      if (error) return toast.error(error.message);
      if (payFor.customer_id) {
        const { data: c } = await (supabase as any).from("customers").select("due_balance").eq("id", payFor.customer_id).single();
        if (c) await (supabase as any).from("customers").update({ due_balance: Math.max(0, Number(c.due_balance || 0) - add) }).eq("id", payFor.customer_id);
      }
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    } else {
      const newPaid = Number(payFor.paid_amount || 0) + add;
      const { error } = await (supabase as any).from("expenses").update({ paid_amount: newPaid }).eq("id", payFor.id);
      if (error) return toast.error(error.message);
    }
    toast.success(t("duePaymentRecorded"));
    setPayFor(null);
    setPayAmt("");
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  const statusBadge = (s: ReturnType<typeof statusOf>) => {
    const cls =
      s === "settled" ? "bg-success/15 text-success" :
      s === "partial" ? "bg-warning/15 text-warning" :
      "bg-destructive/15 text-destructive";
    return <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>{t(s)}</span>;
  };

  const partyBadge = (pt: string) => {
    const isCust = pt === "customer";
    const label = isCust ? t("receivable") : pt === "supplier" ? t("payable") : t("partyOther");
    const cls = isCust ? "text-info" : pt === "supplier" ? "text-warning" : "text-muted-foreground";
    return <span className={`text-xs font-medium ${cls}`}>{label}</span>;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t("expenses")}
        subtitle={t("expensesSubtitle")}
        actions={<Button onClick={() => { resetForm(); setOpenForm(true); }}><Plus className="h-4 w-4 mr-2" />{t("newExpense")}</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label={t("transactions")} value={lang === "bn" ? stats.count.toLocaleString("bn-BD") : String(stats.count)} />
        <StatCard label={t("receivable")} value={fmtMoney(stats.receivable, lang)} tone="info" />
        <StatCard label={t("payable")} value={fmtMoney(stats.payable, lang)} tone="warning" />
        <StatCard label={t("settled")} value={fmtMoney(stats.settled, lang)} tone="success" />
      </div>

      <div className="card-premium p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchExpensesPlaceholder")} className="pl-9" />
        </div>
        <Select value={pType} onValueChange={setPType}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allParties")}</SelectItem>
            <SelectItem value="customer">{t("partyCustomer")}</SelectItem>
            <SelectItem value="supplier">{t("partySupplier")}</SelectItem>
            <SelectItem value="other">{t("partyOther")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={pStatus} onValueChange={setPStatus}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatus")}</SelectItem>
            <SelectItem value="open">{t("open")}</SelectItem>
            <SelectItem value="partial">{t("partial")}</SelectItem>
            <SelectItem value="settled">{t("settled")}</SelectItem>
          </SelectContent>
        </Select>
        <DateInput value={from} onChange={setFrom} className="w-full sm:w-[160px]" />
        <DateInput value={to} onChange={setTo} className="w-full sm:w-[160px]" />
        {(q || pType !== "all" || pStatus !== "all" || from || to) && (
          <Button variant="ghost" onClick={() => { setQ(""); setPType("all"); setPStatus("all"); setFrom(""); setTo(""); }}>{t("clear")}</Button>
        )}
      </div>

      {/* Desktop table */}
      <div className="card-premium overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
              <tr className="text-left">
                <th className="py-3 px-4">{t("date")}</th>
                <th className="py-3 px-4">{t("partyName")}</th>
                <th className="py-3 px-4">{t("description")}</th>
                <th className="py-3 px-4">{t("dueDate")}</th>
                <th className="py-3 px-4 text-right">{t("amount")}</th>
                <th className="py-3 px-4 text-right">{t("paidAmount")}</th>
                <th className="py-3 px-4 text-right">{t("remaining")}</th>
                <th className="py-3 px-4">{t("status")}</th>
                <th className="py-3 px-4 text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">{t("noData")}</td></tr>
              )}
              {filtered.map((e) => {
                const remaining = Math.max(0, Number(e.amount) - Number(e.paid_amount || 0));
                const s = statusOf(e);
                const overdue = e.due_date && s !== "settled" && e.due_date < todayStr();
                return (
                  <tr key={e.id} className="border-t border-border/40 hover:bg-muted/30">
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{fmtDate(e.expense_date, lang)}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{e.party_name || "—"}</div>
                      {partyBadge(e.party_type)}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground max-w-[260px] truncate">{e.description}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {e.due_date ? (
                        <span className={overdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {fmtDate(e.due_date, lang)}{overdue ? ` · ${t("overdue")}` : ""}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{fmtMoney(e.amount, lang)}</td>
                    <td className="py-3 px-4 text-right font-mono text-success">{fmtMoney(e.paid_amount || 0, lang)}</td>
                    <td className="py-3 px-4 text-right font-mono text-warning">{fmtMoney(remaining, lang)}</td>
                    <td className="py-3 px-4">{statusBadge(s)}</td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-1">
                        {s !== "settled" && (
                          <Button size="icon" variant="ghost" onClick={() => { setPayFor(e); setPayAmt(""); }} title={t("recordDuePayment")} aria-label={t("recordDuePayment")}>
                            <Wallet className="h-4 w-4 text-success" />
                          </Button>
                        )}
                        {e.source !== "sale" && <Button size="icon" variant="ghost" onClick={() => openEdit(e)} title={t("edit")} aria-label={t("edit")}><Pencil className="h-4 w-4" /></Button>}
                        {e.source !== "sale" && <Button size="icon" variant="ghost" onClick={() => setDel(e)} title={t("delete")} aria-label={t("delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="card-premium p-8 text-center text-muted-foreground text-sm">{t("noData")}</div>
        )}
        {filtered.map((e) => {
          const remaining = Math.max(0, Number(e.amount) - Number(e.paid_amount || 0));
          const s = statusOf(e);
          const overdue = e.due_date && s !== "settled" && e.due_date < todayStr();
          return (
            <div key={e.id} className="card-premium p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{e.party_name || "—"}</div>
                  <div className="mt-0.5">{partyBadge(e.party_type)}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.description}</div>
                </div>
                <div className="shrink-0">{statusBadge(s)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">{t("date")}</div>
                  <div>{fmtDate(e.expense_date, lang)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t("dueDate")}</div>
                  <div className={overdue ? "text-destructive font-medium" : ""}>
                    {e.due_date ? fmtDate(e.due_date, lang) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t("amount")}</div>
                  <div className="font-mono font-medium">{fmtMoney(e.amount, lang)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t("remaining")}</div>
                  <div className="font-mono text-warning">{fmtMoney(remaining, lang)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1 border-t">
                {s !== "settled" && (
                  <Button size="sm" variant="ghost" className="min-h-11 flex-1" onClick={() => { setPayFor(e); setPayAmt(""); }}>
                    <Wallet className="h-4 w-4 mr-1 text-success" />{t("recordDuePayment")}
                  </Button>
                )}
                {e.source !== "sale" && (
                  <Button size="sm" variant="ghost" className="min-h-11" onClick={() => openEdit(e)} aria-label={t("edit")}><Pencil className="h-4 w-4" /></Button>
                )}
                {e.source !== "sale" && (
                  <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setDel(e)} aria-label={t("delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                )}
              </div>
            </div>
          );
        })}
      </div>


      <Dialog open={openForm} onOpenChange={(o) => { if (!o) { setOpenForm(false); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit ? t("editExpense") : t("newExpense")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t("date")}</label>
                <DateInput value={fDate} onChange={setFDate} clearable={false} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("dueDate")}</label>
                <DateInput value={fDueDate} onChange={setFDueDate} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t("partyName")}</label>
                <Input value={fParty} onChange={(e) => setFParty(e.target.value)} placeholder={t("partyNamePlaceholder")} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("partyType")}</label>
                <Select value={fPartyType} onValueChange={setFPartyType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">{t("partyCustomer")}</SelectItem>
                    <SelectItem value="supplier">{t("partySupplier")}</SelectItem>
                    <SelectItem value="other">{t("partyOther")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("description")}</label>
              <Input value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder={t("descriptionPlaceholder")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t("amount")}</label>
                <Input type="number" min="0" step="0.01" value={fAmt} onChange={(e) => setFAmt(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("paidAmount")}</label>
                <Input type="number" min="0" step="0.01" value={fPaid} onChange={(e) => setFPaid(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("method")}</label>
              <Select value={fMethod} onValueChange={setFMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("methodCash")}</SelectItem>
                  <SelectItem value="card">{t("methodCard")}</SelectItem>
                  <SelectItem value="mobile">{t("methodMobile")}</SelectItem>
                  <SelectItem value="bank">{t("methodBank")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("note")}</label>
              <Textarea value={fNote} onChange={(e) => setFNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpenForm(false); resetForm(); }}>{t("cancel")}</Button>
            <Button onClick={save}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payFor} onOpenChange={(o) => { if (!o) { setPayFor(null); setPayAmt(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("recordDuePayment")}</DialogTitle></DialogHeader>
          {payFor && (
            <div className="space-y-3">
              <div className="text-sm">
                <div className="font-medium">{payFor.party_name}</div>
                <div className="text-muted-foreground">{payFor.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="card-premium p-3">
                  <div className="text-xs text-muted-foreground">{t("amount")}</div>
                  <div className="font-mono">{fmtMoney(payFor.amount, lang)}</div>
                </div>
                <div className="card-premium p-3">
                  <div className="text-xs text-muted-foreground">{t("remaining")}</div>
                  <div className="font-mono text-warning">
                    {fmtMoney(Math.max(0, Number(payFor.amount) - Number(payFor.paid_amount || 0)), lang)}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("amountToPay")}</label>
                <Input type="number" min="0" step="0.01" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} autoFocus />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPayFor(null); setPayAmt(""); }}>{t("cancel")}</Button>
            <Button onClick={recordPayment}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteExpenseTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteExpenseDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "info" }) {
  const cls =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "info" ? "text-info" : "";
  return (
    <div className="card-premium p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold mt-1 font-mono ${cls}`}>{value}</div>
    </div>
  );
}
