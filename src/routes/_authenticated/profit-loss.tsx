import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { fmtMoney } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  ShoppingCart,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profit-loss")({
  component: ProfitLossPage,
});

type Period = "daily" | "monthly" | "yearly";

function getRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);
  if (period === "daily") {
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  } else if (period === "monthly") {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  } else {
    from.setMonth(0, 1);
    from.setHours(0, 0, 0, 0);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

async function fetchPnL(period: Period) {
  const { from, to } = getRange(period);
  const [salesRes, purchasesRes, expensesRes, customersRes] = await Promise.all([
    supabase.from("sales").select("total, paid, due, created_at").gte("created_at", from).lte("created_at", to),
    supabase.from("purchases").select("total, created_at").gte("created_at", from).lte("created_at", to),
    supabase.from("expenses").select("amount, created_at").gte("created_at", from).lte("created_at", to),
    supabase.from("customers").select("due_balance"),
  ]);
  const sales = (salesRes.data ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
  const collected = (salesRes.data ?? []).reduce((s, r) => s + Number(r.paid ?? 0), 0);
  const salesDue = (salesRes.data ?? []).reduce((s, r) => s + Number(r.due ?? 0), 0);
  const purchases = (purchasesRes.data ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
  const expenses = (expensesRes.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const customerDue = (customersRes.data ?? []).reduce((s, r) => s + Number(r.due_balance ?? 0), 0);
  const profit = sales - purchases - expenses;
  return { sales, collected, salesDue, purchases, expenses, customerDue, profit };
}

function ProfitLossPage() {
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>("daily");
  const { data: pnl } = useQuery({ queryKey: ["pnl", period], queryFn: () => fetchPnL(period) });

  const periodLabel = period === "daily" ? "আজকের" : period === "monthly" ? "এই মাসের" : "এই বছরের";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader title={t("profitLoss")} />

      <div className="card-premium p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-semibold text-base">{periodLabel} লাভ-ক্ষতির সারাংশ</h3>
          <div className="flex items-center gap-2">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList>
                <TabsTrigger value="daily">দৈনিক</TabsTrigger>
                <TabsTrigger value="monthly">মাসিক</TabsTrigger>
                <TabsTrigger value="yearly">বাৎসরিক</TabsTrigger>
              </TabsList>
            </Tabs>
            {pnl && (
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  pnl.profit >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                }`}
              >
                {pnl.profit >= 0 ? "লাভ" : "ক্ষতি"}
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border/40 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> মোট বিক্রয়
            </div>
            <div className="font-mono font-semibold">{fmtMoney(pnl?.sales ?? 0)}</div>
          </div>
          <div className="rounded-lg border border-border/40 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <ShoppingCart className="h-3.5 w-3.5" /> মোট ক্রয়
            </div>
            <div className="font-mono font-semibold">{fmtMoney(pnl?.purchases ?? 0)}</div>
          </div>
          <div className="rounded-lg border border-border/40 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Receipt className="h-3.5 w-3.5" /> মোট খরচ
            </div>
            <div className="font-mono font-semibold">{fmtMoney(pnl?.expenses ?? 0)}</div>
          </div>
          <div className="rounded-lg border border-border/40 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Wallet className="h-3.5 w-3.5" /> গ্রাহকের বাকি (সর্বমোট)
            </div>
            <div className="font-mono font-semibold text-warning">{fmtMoney(pnl?.customerDue ?? 0)}</div>
          </div>
          <div className="rounded-lg border border-border/40 p-3">
            <div className="text-xs text-muted-foreground mb-1">আদায়কৃত</div>
            <div className="font-mono font-semibold">{fmtMoney(pnl?.collected ?? 0)}</div>
          </div>
          <div className="rounded-lg border border-border/40 p-3">
            <div className="text-xs text-muted-foreground mb-1">বিক্রয়ের বাকি</div>
            <div className="font-mono font-semibold text-warning">{fmtMoney(pnl?.salesDue ?? 0)}</div>
          </div>
          <div
            className={`rounded-lg border p-3 col-span-2 ${
              pnl && pnl.profit >= 0
                ? "border-success/40 bg-success/5"
                : "border-destructive/40 bg-destructive/5"
            }`}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              {pnl && pnl.profit >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              নিট {pnl && pnl.profit >= 0 ? "লাভ" : "ক্ষতি"}
            </div>
            <div
              className={`font-mono font-bold text-lg ${
                pnl && pnl.profit >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {fmtMoney(Math.abs(pnl?.profit ?? 0))}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          * নিট লাভ = মোট বিক্রয় − মোট ক্রয় − মোট খরচ ({periodLabel})
        </p>
      </div>
    </div>
  );
}
