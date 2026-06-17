import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Search, Plus, ArrowDownCircle, ArrowUpCircle, Settings2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CashbookCategoryManagerDialog, fetchCashbookCategories } from "@/components/CashbookCategoryManagerDialog";
import { DateInput } from "@/components/DateInput";

export const Route = createFileRoute("/_authenticated/cashbook")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: ["cashbook"], queryFn: fetchEntries });
  },
  component: CashbookPage,
  errorComponent: ({ error }) => { console.error(error); return <div className="p-8 text-destructive">Something went wrong loading this page.</div>; },
  notFoundComponent: () => <div className="p-4 sm:p-6 lg:p-8">Not found</div>,
});

type Entry = {
  id: string;
  entry_date: string;
  type: "income" | "expense";
  category: string | null;
  description: string;
  amount: number;
  method: string;
  note: string | null;
  created_at: string;
};

async function fetchEntries(): Promise<Entry[]> {
  const { data, error } = await (supabase as any)
    .from("cashbook")
    .select("id,entry_date,type,category,description,amount,method,note,created_at")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as Entry[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function CashbookPage() {
  const { t, lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: ["cashbook"], queryFn: fetchEntries });

  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState<"all" | "income" | "expense">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [openForm, setOpenForm] = useState(false);
  const [edit, setEdit] = useState<Entry | null>(null);
  const [del, setDel] = useState<Entry | null>(null);
  const [catMgr, setCatMgr] = useState(false);

  const { data: cats = [] } = useQuery({ queryKey: ["cashbook-categories"], queryFn: fetchCashbookCategories });

  const [fDate, setFDate] = useState(todayStr());
  const [fType, setFType] = useState<"income" | "expense">("income");
  const [fCat, setFCat] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fAmt, setFAmt] = useState("");
  const [fMethod, setFMethod] = useState("cash");
  const [fNote, setFNote] = useState("");

  const labels = {
    title: bn ? "জমা/খরচ" : "Income / Expense",
    subtitle: bn ? "দৈনিক জমা ও খরচের হিসাব রাখুন।" : "Track your daily income and expenses.",
    newEntry: bn ? "নতুন এন্ট্রি" : "New entry",
    editEntry: bn ? "এন্ট্রি সম্পাদনা" : "Edit entry",
    income: bn ? "জমা" : "Income",
    expense: bn ? "খরচ" : "Expense",
    all: bn ? "সব" : "All",
    category: bn ? "ক্যাটাগরি" : "Category",
    categoryPh: bn ? "যেমন: বেতন, বিদ্যুৎ বিল…" : "e.g. Salary, Electricity bill…",
    type: bn ? "ধরন" : "Type",
    totalIncome: bn ? "মোট জমা" : "Total income",
    totalExpense: bn ? "মোট খরচ" : "Total expense",
    balance: bn ? "ব্যালেন্স" : "Balance",
    transactions: bn ? "এন্ট্রি" : "Entries",
    searchPh: bn ? "বিবরণ, ক্যাটাগরি, মন্তব্য…" : "Description, category, note…",
    deleteTitle: bn ? "এন্ট্রি মুছবেন" : "Delete entry",
    deleteDesc: bn ? "এই এন্ট্রিটি স্থায়ীভাবে মুছে যাবে।" : "This entry will be permanently removed.",
    created: bn ? "এন্ট্রি যোগ হয়েছে" : "Entry added",
    updated: bn ? "এন্ট্রি আপডেট হয়েছে" : "Entry updated",
    deleted: bn ? "এন্ট্রি মুছে ফেলা হয়েছে" : "Entry deleted",
  };

  const filtered = useMemo(() => data.filter((e) => {
    if (typeF !== "all" && e.type !== typeF) return false;
    if (q) {
      const hay = `${e.description ?? ""} ${e.category ?? ""} ${e.note ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    if (from && e.entry_date < from) return false;
    if (to && e.entry_date > to) return false;
    return true;
  }), [data, q, typeF, from, to]);

  const stats = useMemo(() => {
    let income = 0, expense = 0;
    for (const r of filtered) {
      if (r.type === "income") income += Number(r.amount || 0);
      else expense += Number(r.amount || 0);
    }
    return { income, expense, balance: income - expense, count: filtered.length };
  }, [filtered]);

  function resetForm() {
    setEdit(null);
    setFDate(todayStr());
    setFType("income");
    setFCat("");
    setFDesc("");
    setFAmt("");
    setFMethod("cash");
    setFNote("");
  }

  function openEdit(e: Entry) {
    setEdit(e);
    setFDate(e.entry_date);
    setFType(e.type);
    setFCat(e.category ?? "");
    setFDesc(e.description);
    setFAmt(String(e.amount));
    setFMethod(e.method);
    setFNote(e.note ?? "");
    setOpenForm(true);
  }

  async function save() {
    const amount = Number(fAmt);
    if (!fDesc.trim()) return toast.error(t("description") + " *");
    if (!amount || amount <= 0) return toast.error(t("enterValidAmount"));
    const payload = {
      entry_date: fDate || todayStr(),
      type: fType,
      category: fCat.trim() || null,
      description: fDesc.trim(),
      amount,
      method: fMethod,
      note: fNote.trim() || null,
    };
    if (edit) {
      const { error } = await (supabase as any).from("cashbook").update(payload).eq("id", edit.id);
      if (error) return toast.error(error.message);
      toast.success(labels.updated);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("cashbook").insert({ ...payload, owner_id: u.user!.id });
      if (error) return toast.error(error.message);
      toast.success(labels.created);
    }
    setOpenForm(false);
    resetForm();
    qc.invalidateQueries({ queryKey: ["cashbook"] });
  }

  async function doDelete() {
    if (!del) return;
    const { error } = await (supabase as any).from("cashbook").delete().eq("id", del.id);
    if (error) return toast.error(error.message);
    toast.success(labels.deleted);
    setDel(null);
    qc.invalidateQueries({ queryKey: ["cashbook"] });
  }

  const typeBadge = (tp: "income" | "expense") => {
    const isIn = tp === "income";
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${isIn ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
        {isIn ? <ArrowDownCircle className="h-3 w-3" /> : <ArrowUpCircle className="h-3 w-3" />}
        {isIn ? labels.income : labels.expense}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={labels.title}
        subtitle={labels.subtitle}
        actions={<Button onClick={() => { resetForm(); setOpenForm(true); }}><Plus className="h-4 w-4 mr-2" />{labels.newEntry}</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label={labels.transactions} value={bn ? stats.count.toLocaleString("bn-BD") : String(stats.count)} />
        <StatCard label={labels.totalIncome} value={fmtMoney(stats.income, lang)} tone="success" />
        <StatCard label={labels.totalExpense} value={fmtMoney(stats.expense, lang)} tone="warning" />
        <StatCard label={labels.balance} value={fmtMoney(stats.balance, lang)} tone={stats.balance >= 0 ? "info" : "warning"} />
      </div>

      <div className="card-premium p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.searchPh} className="pl-9" />
        </div>
        <Select value={typeF} onValueChange={(v) => setTypeF(v as any)}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{labels.all}</SelectItem>
            <SelectItem value="income">{labels.income}</SelectItem>
            <SelectItem value="expense">{labels.expense}</SelectItem>
          </SelectContent>
        </Select>
        <DateInput value={from} onChange={setFrom} className="w-full sm:w-[160px]" />
        <DateInput value={to} onChange={setTo} className="w-full sm:w-[160px]" />
        {(q || typeF !== "all" || from || to) && (
          <Button variant="ghost" onClick={() => { setQ(""); setTypeF("all"); setFrom(""); setTo(""); }}>{t("clear")}</Button>
        )}
      </div>

      {/* Desktop */}
      <div className="card-premium overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
              <tr className="text-left">
                <th className="py-3 px-4">{t("date")}</th>
                <th className="py-3 px-4">{labels.type}</th>
                <th className="py-3 px-4">{labels.category}</th>
                <th className="py-3 px-4">{t("description")}</th>
                <th className="py-3 px-4">{t("method")}</th>
                <th className="py-3 px-4 text-right">{t("amount")}</th>
                <th className="py-3 px-4 text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">{t("noData")}</td></tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-border/40 hover:bg-muted/30">
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{fmtDate(e.entry_date, lang)}</td>
                  <td className="py-3 px-4">{typeBadge(e.type)}</td>
                  <td className="py-3 px-4 text-muted-foreground">{e.category || "—"}</td>
                  <td className="py-3 px-4 max-w-[260px] truncate">{e.description}</td>
                  <td className="py-3 px-4 text-muted-foreground capitalize">{e.method}</td>
                  <td className={`py-3 px-4 text-right font-mono ${e.type === "income" ? "text-success" : "text-destructive"}`}>
                    {e.type === "income" ? "+" : "−"}{fmtMoney(e.amount, lang)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(e)} aria-label={t("edit")}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDel(e)} aria-label={t("delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="card-premium p-8 text-center text-muted-foreground text-sm">{t("noData")}</div>
        )}
        {filtered.map((e) => (
          <div key={e.id} className="card-premium p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1">{typeBadge(e.type)}</div>
                <div className="font-medium truncate">{e.description}</div>
                {e.category && <div className="text-xs text-muted-foreground mt-0.5">{e.category}</div>}
              </div>
              <div className={`shrink-0 font-mono font-semibold ${e.type === "income" ? "text-success" : "text-destructive"}`}>
                {e.type === "income" ? "+" : "−"}{fmtMoney(e.amount, lang)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">{t("date")}</div>
                <div>{fmtDate(e.entry_date, lang)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("method")}</div>
                <div className="capitalize">{e.method}</div>
              </div>
            </div>
            <div className="flex gap-2 pt-1 border-t">
              <Button size="sm" variant="ghost" className="min-h-11 flex-1" onClick={() => openEdit(e)}><Pencil className="h-4 w-4 mr-1" />{t("edit")}</Button>
              <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setDel(e)} aria-label={t("delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={openForm} onOpenChange={(o) => { if (!o) { setOpenForm(false); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit ? labels.editEntry : labels.newEntry}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t("date")}</label>
                <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{labels.type}</label>
                <Select value={fType} onValueChange={(v) => setFType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">{labels.income}</SelectItem>
                    <SelectItem value="expense">{labels.expense}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">{labels.category}</label>
                <button type="button" onClick={() => setCatMgr(true)} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  <Settings2 className="h-3 w-3" />{bn ? "ম্যানেজ" : "Manage"}
                </button>
              </div>
              <Select value={fCat || "__none__"} onValueChange={(v) => setFCat(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder={labels.categoryPh} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{bn ? "— কোনটি নয় —" : "— None —"}</SelectItem>
                  {cats.filter((c) => c.type === fType).map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                  {fCat && !cats.some((c) => c.type === fType && c.name === fCat) && (
                    <SelectItem value={fCat}>{fCat}</SelectItem>
                  )}
                </SelectContent>
              </Select>
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

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{labels.deleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CashbookCategoryManagerDialog open={catMgr} onOpenChange={setCatMgr} initialType={fType} />
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
