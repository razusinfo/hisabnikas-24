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
  ShoppingCart,
  PackageOpen,
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

  // 1. Get sales in period
  const { data: salesData } = await supabase
    .from("sales")
    .select("id, total, paid, due")
    .gte("created_at", from)
    .lte("created_at", to);

  const saleIds = (salesData ?? []).map((s) => s.id);

  // 2. Get totals from sales
  const totalSales = (salesData ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
  const collected = (salesData ?? []).reduce((s, r) => s + Number(r.paid ?? 0), 0);
  const salesDue = (salesData ?? []).reduce((s, r) => s + Number(r.due ?? 0), 0);

  // 3. Get sale items for sold products
  let revenue = 0;
  let cost = 0;

  if (saleIds.length > 0) {
    const { data: itemsData } = await supabase
      .from("sale_items")
      .select("qty, line_total, product_id")
      .in("sale_id", saleIds);

    const productIds = [
      ...new Set((itemsData ?? []).map((i) => i.product_id).filter(Boolean)),
    ];

    let costMap = new Map<string, number>();
    if (productIds.length > 0) {
      const { data: productsData } = await supabase
        .from("products")
        .select("id, cost_price")
        .in("id", productIds);
      costMap = new Map(
        (productsData ?? []).map((p) => [p.id, Number(p.cost_price ?? 0)])
      );
    }

    for (const item of itemsData ?? []) {
      const qty = Number(item.qty ?? 0);
      const lineTotal = Number(item.line_total ?? 0);
      const unitCost = item.product_id ? (costMap.get(item.product_id) ?? 0) : 0;
      revenue += lineTotal;
      cost += qty * unitCost;
    }
  }

  const profit = revenue - cost;

  return { revenue, cost, profit, totalSales, collected, salesDue };
}

function ProfitLossPage() {
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>("daily");
  const { data: pnl } = useQuery({
    queryKey: ["pnl", period],
    queryFn: () => fetchPnL(period),
  });

  const periodLabel =
    period === "daily"
      ? "আজকের"
      : period === "monthly"
        ? "এই মাসের"
        : "এই বছরের";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader title={t("profitLoss")} />

      <div className="card-premium p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-semibold text-base">
            {periodLabel} লাভ-ক্ষতির সারাংশ
          </h3>
          <div className="flex items-center gap-2">
            <Tabs
              value={period}
              onValueChange={(v) => setPeriod(v as Period)}
            >
              <TabsList>
                <TabsTrigger value="daily">দৈনিক</TabsTrigger>
                <TabsTrigger value="monthly">মাসিক</TabsTrigger>
                <TabsTrigger value="yearly">বাৎসরিক</TabsTrigger>
              </TabsList>
            </Tabs>
            {pnl && (
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  pnl.profit >= 0
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {pnl.profit >= 0 ? "লাভ" : "ক্ষতি"}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Product revenue */}
          <div className="rounded-lg border border-border/40 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              বিক্রিত পণ্যের মোট মূল্য
            </div>
            <div className="font-mono font-semibold">
              {fmtMoney(pnl?.revenue ?? 0)}
            </div>
          </div>

          {/* Product cost */}
          <div className="rounded-lg border border-border/40 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <ShoppingCart className="h-3.5 w-3.5" />
              বিক্রিত পণ্যের ক্রয় মূল্য
            </div>
            <div className="font-mono font-semibold">
              {fmtMoney(pnl?.cost ?? 0)}
            </div>
          </div>

          {/* Collected */}
          <div className="rounded-lg border border-border/40 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Wallet className="h-3.5 w-3.5" />
              আদায়কৃত
            </div>
            <div className="font-mono font-semibold">
              {fmtMoney(pnl?.collected ?? 0)}
            </div>
          </div>

          {/* Sales due */}
          <div className="rounded-lg border border-border/40 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <PackageOpen className="h-3.5 w-3.5" />
              বিক্রয়ের বাকি
            </div>
            <div className="font-mono font-semibold text-warning">
              {fmtMoney(pnl?.salesDue ?? 0)}
            </div>
          </div>

          {/* Product profit / loss — spans full row on mobile, 2 cols on md+ */}
          <div
            className={`rounded-lg border p-3 col-span-2 md:col-span-4 ${
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
              পণ্য থেকে নিট {pnl && pnl.profit >= 0 ? "লাভ" : "ক্ষতি"}
            </div>
            <div
              className={`font-mono font-bold text-lg ${
                pnl && pnl.profit >= 0
                  ? "text-success"
                  : "text-destructive"
              }`}
            >
              {fmtMoney(Math.abs(pnl?.profit ?? 0))}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          * পণ্য থেকে নিট লাভ = বিক্রিত পণ্যের মোট মূল্য − বিক্রিত পণ্যের ক্রয়
          মূল্য ({periodLabel})
        </p>
      </div>
    </div>
  );
}
