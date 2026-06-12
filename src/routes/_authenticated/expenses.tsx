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
import { Pencil, Trash2, Search, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/expenses")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: ["expenses"], queryFn: fetchExpenses });
  },
  component: ExpensesPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

async function fetchExpenses() {
  const { data, error } = await (supabase as any)
    .from("expenses")
    .select("id,expense_date,description,amount,method,note,created_at")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

type Expense = {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  method: string;
  note: string | null;
  created_at: string;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function ExpensesPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: ["expenses"], queryFn: fetchExpenses });

  const [q, setQ] = useState("");
  const [method, setMethodFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [openForm, setOpenForm] = useState(false);
  const [edit, setEdit] = useState<Expense | null>(null);
  const [del, setDel] = useState<Expense | null>(null);

  const [fDate, setFDate] = useState(todayStr());
  const [fDesc, setFDesc] = useState("");
  const [fAmt, setFAmt] = useState("");
  const [fMethod, setFMethod] = useState("cash");
  const [fNote, setFNote] = useState("");

  const methodLabel = (m: string) => {
    const key = `method${m ? m.charAt(0).toUpperCase() + m.slice(1) : ""}` as any;
    const v = (t as any)(key);
    return v && v !== key ? v : m;
  };

  const filtered = useMemo(() => (data as Expense[]).filter((e) => {
    if (q) {
      const hay = `${e.description ?? ""} ${e.note ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    if (method !== "all" && e.method !== method) return false;
    if (from && e.expense_date < from) return false;
    if (to && e.expense_date > to) return false;
    return true;
  }), [data, q, method, from, to]);

  const stats = useMemo(() => {
    const today = todayStr();
    const monthStart = today.slice(0, 7) + "-01";
    const all = data as Expense[];
    const total = filtered.reduce((a, e) => a + Number(e.amount || 0), 0);
    const tToday = all.filter(e => e.expense_date === today).reduce((a, e) => a + Number(e.amount || 0), 0);
    const tMonth = all.filter(e => e.expense_date >= monthStart).reduce((a, e) => a + Number(e.amount || 0), 0);
    return { count: filtered.length, total, today: tToday, month: tMonth };
  }, [data, filtered]);

  function resetForm() {
    setEdit(null);
    setFDate(todayStr());
    setFDesc("");
    setFAmt("");
    setFMethod("cash");
    setFNote("");
  }

  function openEdit(e: Expense) {
    setEdit(e);
    setFDate(e.expense_date);
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
      expense_date: fDate || todayStr(),
      description: fDesc.trim(),
      amount,
      method: fMethod,
      note: fNote.trim() || null,
    };
    if (edit) {
      const { error } = await (supabase as any).from("expenses").update(payload).eq("id", edit.id);
      if (error) return toast.error(error.message);
      toast.success(t("expenseUpdated"));
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("expenses").insert({ ...payload, owner_id: u.user!.id });
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

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t("expenses")}
        subtitle={t("expensesSubtitle")}
        actions={<Button onClick={() => { resetForm(); setOpenForm(true); }}><Plus className="h-4 w-4 mr-2" />{t("newExpense")}</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label={t("transactions")} value={lang === "bn" ? stats.count.toLocaleString("bn-BD") : String(stats.count)} />
        <StatCard label={t("totalExpenses")} value={fmtMoney(stats.total, lang)} tone="warning" />
        <StatCard label={t("expensesToday")} value={fmtMoney(stats.today, lang)} />
        <StatCard label={t("expensesMonth")} value={fmtMoney(stats.month, lang)} />
      </div>

      <div className="card-premium p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchExpensesPlaceholder")} className="pl-9" />
        </div>
        <Select value={method} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatus")}</SelectItem>
            <SelectItem value="cash">{t("methodCash")}</SelectItem>
            <SelectItem value="card">{t("methodCard")}</SelectItem>
            <SelectItem value="mobile">{t("methodMobile")}</SelectItem>
            <SelectItem value="bank">{t("methodBank")}</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
        {(q || method !== "all" || from || to) && (
          <Button variant="ghost" onClick={() => { setQ(""); setMethodFilter("all"); setFrom(""); setTo(""); }}>{t("clear")}</Button>
        )}
      </div>

      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
              <tr className="text-left">
                <th className="py-3 px-4">{t("date")}</th>
                <th className="py-3 px-4">{t("description")}</th>
                <th className="py-3 px-4">{t("method")}</th>
                <th className="py-3 px-4">{t("note")}</th>
                <th className="py-3 px-4 text-right">{t("amount")}</th>
                <th className="py-3 px-4 text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">{t("noData")}</td></tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-border/40 hover:bg-muted/30">
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{fmtDate(e.expense_date, lang)}</td>
                  <td className="py-3 px-4 font-medium">{e.description}</td>
                  <td className="py-3 px-4">{methodLabel(e.method)}</td>
                  <td className="py-3 px-4 text-muted-foreground max-w-[260px] truncate">{e.note || "—"}</td>
                  <td className="py-3 px-4 text-right font-mono text-warning">{fmtMoney(e.amount, lang)}</td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(e)} title={t("edit")}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDel(e)} title={t("delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={openForm} onOpenChange={(o) => { if (!o) { setOpenForm(false); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit ? t("editExpense") : t("newExpense")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t("date")}</label>
                <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("amount")}</label>
                <Input type="number" min="0" step="0.01" value={fAmt} onChange={(e) => setFAmt(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("description")}</label>
              <Input value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder={t("descriptionPlaceholder")} />
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

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="card-premium p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold mt-1 font-mono ${cls}`}>{value}</div>
    </div>
  );
}
