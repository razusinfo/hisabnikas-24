import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { fmtMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  PackageOpen,
  Wallet,
  CalendarIcon,
  CalendarDays,
  CalendarRange,
  SlidersHorizontal,
  Receipt,
  Printer,
  Coins,
  Boxes,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profit-loss")({
  component: ProfitLossPage,
});

type Period = "daily" | "monthly" | "yearly" | "custom";

type Range = { from: string; to: string };

function getRange(
  period: Period,
  custom?: { from?: Date; to?: Date },
): Range {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);
  if (period === "custom") {
    const f = custom?.from ? new Date(custom.from) : new Date(now);
    const t = custom?.to ? new Date(custom.to) : new Date(custom?.from ?? now);
    f.setHours(0, 0, 0, 0);
    t.setHours(23, 59, 59, 999);
    return { from: f.toISOString(), to: t.toISOString() };
  }
  if (period === "daily") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "monthly") {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  } else {
    from.setMonth(0, 1);
    from.setHours(0, 0, 0, 0);
  }
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

type TopProduct = { name: string; qty: number; revenue: number; profit: number };
type ExpenseRow = { description: string; amount: number };

async function fetchPnL(range: Range) {
  const { from, to } = range;

  const { data: salesData } = await supabase
    .from("sales")
    .select("id, total, paid, due")
    .gte("created_at", from)
    .lte("created_at", to);

  const saleIds = (salesData ?? []).map((s) => s.id);
  const totalSales = (salesData ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
  const collected = (salesData ?? []).reduce((s, r) => s + Number(r.paid ?? 0), 0);
  const salesDue = (salesData ?? []).reduce((s, r) => s + Number(r.due ?? 0), 0);
  const salesCount = (salesData ?? []).length;

  let revenue = 0;
  let cost = 0;
  let itemsSold = 0;
  const productAgg = new Map<
    string,
    { name: string; qty: number; revenue: number; cost: number }
  >();

  if (saleIds.length > 0) {
    const { data: itemsData } = await supabase
      .from("sale_items")
      .select("qty, line_total, product_id, product_name")
      .in("sale_id", saleIds);

    const productIds = [
      ...new Set(
        (itemsData ?? [])
          .map((i) => i.product_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    let costMap = new Map<string, number>();
    if (productIds.length > 0) {
      const { data: productsData } = await supabase
        .from("products")
        .select("id, cost_price")
        .in("id", productIds);
      costMap = new Map(
        (productsData ?? []).map((p) => [p.id, Number(p.cost_price ?? 0)]),
      );
    }

    for (const item of (itemsData ?? []) as Array<{
      qty: number | null;
      line_total: number | null;
      product_id: string | null;
      product_name: string | null;
    }>) {
      const qty = Number(item.qty ?? 0);
      const lineTotal = Number(item.line_total ?? 0);
      const unitCost = item.product_id ? (costMap.get(item.product_id) ?? 0) : 0;
      const itemCost = qty * unitCost;
      revenue += lineTotal;
      cost += itemCost;
      itemsSold += qty;

      const key = item.product_id ?? `__${item.product_name ?? "অজানা"}`;
      const prev = productAgg.get(key) ?? {
        name: item.product_name ?? "অজানা পণ্য",
        qty: 0,
        revenue: 0,
        cost: 0,
      };
      prev.qty += qty;
      prev.revenue += lineTotal;
      prev.cost += itemCost;
      productAgg.set(key, prev);
    }
  }

  // Operating expenses in the period (by expense_date)
  const fromDate = from.slice(0, 10);
  const toDate = to.slice(0, 10);
  const { data: expData } = await supabase
    .from("expenses")
    .select("description, amount, expense_date")
    .gte("expense_date", fromDate)
    .lte("expense_date", toDate)
    .order("expense_date", { ascending: false });

  const expenses = (expData ?? []).reduce(
    (s, r) => s + Number((r as { amount: number | null }).amount ?? 0),
    0,
  );
  const expenseRows: ExpenseRow[] = (expData ?? []).map((r) => ({
    description:
      (r as { description: string | null }).description ?? "(বিবরণ নেই)",
    amount: Number((r as { amount: number | null }).amount ?? 0),
  }));

  const grossProfit = revenue - cost;
  const netProfit = grossProfit - expenses;

  const topProducts: TopProduct[] = [...productAgg.values()]
    .map((p) => ({
      name: p.name,
      qty: p.qty,
      revenue: p.revenue,
      profit: p.revenue - p.cost,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    revenue,
    cost,
    grossProfit,
    expenses,
    netProfit,
    totalSales,
    collected,
    salesDue,
    salesCount,
    itemsSold,
    topProducts,
    expenseRows: expenseRows.slice(0, 5),
    expenseCount: expenseRows.length,
  };
}

function ProfitLossPage() {
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>("daily");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);

  const range = useMemo(
    () => getRange(period, { from: customFrom, to: customTo }),
    [
      period,
      customFrom?.getTime(),
      customTo?.getTime(),
      // re-evaluate when the calendar day changes
      new Date().toDateString(),
    ],
  );
  const customReady = period !== "custom" || (customFrom && customTo);

  const { data: pnl, isLoading } = useQuery({
    queryKey: ["pnl", period, range.from, range.to],
    queryFn: () => fetchPnL(range),
    enabled: Boolean(customReady),
  });

  const periodLabel =
    period === "daily"
      ? "আজকের"
      : period === "monthly"
        ? "এই মাসের"
        : period === "yearly"
          ? "এই বছরের"
          : customFrom && customTo
            ? `${format(customFrom, "dd/MM/yyyy")} - ${format(customTo, "dd/MM/yyyy")}`
            : "কাস্টম";

  const net = pnl?.netProfit ?? 0;
  const gross = pnl?.grossProfit ?? 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto print:p-0">
      <PageHeader title={t("profitLoss")} />

      <div className="card-premium p-5 print:shadow-none print:border-0">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-semibold text-base">
            {periodLabel} লাভ-ক্ষতির সারাংশ
          </h3>
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList>
                <TabsTrigger value="daily">দৈনিক</TabsTrigger>
                <TabsTrigger value="monthly">মাসিক</TabsTrigger>
                <TabsTrigger value="yearly">বাৎসরিক</TabsTrigger>
                <TabsTrigger value="custom">কাস্টম</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-1"
            >
              <Printer className="h-4 w-4" /> প্রিন্ট
            </Button>
            {pnl && (
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  net >= 0
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {net >= 0 ? "নিট লাভ" : "নিট ক্ষতি"}
              </span>
            )}
          </div>
        </div>

        {period === "custom" && (
          <div className="flex items-center gap-2 mb-4 flex-wrap print:hidden">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !customFrom && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customFrom ? format(customFrom, "dd/MM/yyyy") : "শুরুর তারিখ"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={setCustomFrom}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-sm">→</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !customTo && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customTo ? format(customTo, "dd/MM/yyyy") : "শেষ তারিখ"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={setCustomTo}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {(!customFrom || !customTo) && (
              <span className="text-xs text-muted-foreground">
                উভয় তারিখ নির্বাচন করুন
              </span>
            )}
          </div>
        )}

        {isLoading && (
          <div className="text-sm text-muted-foreground py-6 text-center">
            লোড হচ্ছে...
          </div>
        )}

        {/* Top metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="বিক্রি (Revenue)"
            value={fmtMoney(pnl?.revenue ?? 0)}
            hint={`${pnl?.salesCount ?? 0} টি বিক্রয়`}
          />
          <Metric
            icon={<ShoppingCart className="h-3.5 w-3.5" />}
            label="ক্রয় মূল্য (COGS)"
            value={fmtMoney(pnl?.cost ?? 0)}
            hint={`${pnl?.itemsSold ?? 0} টি পণ্য বিক্রি`}
          />
          <Metric
            icon={<Receipt className="h-3.5 w-3.5" />}
            label="পরিচালন খরচ"
            value={fmtMoney(pnl?.expenses ?? 0)}
            hint={`${pnl?.expenseCount ?? 0} টি এন্ট্রি`}
            tone="warning"
          />
          <Metric
            icon={<Coins className="h-3.5 w-3.5" />}
            label="গ্রস লাভ"
            value={fmtMoney(gross)}
            tone={gross >= 0 ? "success" : "destructive"}
          />
          <Metric
            icon={<Wallet className="h-3.5 w-3.5" />}
            label="আদায়কৃত"
            value={fmtMoney(pnl?.collected ?? 0)}
          />
          <Metric
            icon={<PackageOpen className="h-3.5 w-3.5" />}
            label="বিক্রয়ের বাকি"
            value={fmtMoney(pnl?.salesDue ?? 0)}
            tone="warning"
          />
          <div
            className={`rounded-lg border p-3 col-span-2 ${
              net >= 0
                ? "border-success/40 bg-success/5"
                : "border-destructive/40 bg-destructive/5"
            }`}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              {net >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              নিট {net >= 0 ? "লাভ" : "ক্ষতি"} (গ্রস − খরচ)
            </div>
            <div
              className={`font-mono font-bold text-xl ${
                net >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {fmtMoney(Math.abs(net))}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          * গ্রস লাভ = বিক্রি − ক্রয় মূল্য। নিট লাভ = গ্রস লাভ − পরিচালন খরচ
          ({periodLabel})।
        </p>
      </div>

      {/* Top products + Expenses breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="card-premium p-5">
          <div className="flex items-center gap-2 mb-3">
            <Boxes className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-base">শীর্ষ বিক্রিত পণ্য</h3>
          </div>
          {pnl && pnl.topProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border/40">
                    <th className="text-left py-2">পণ্য</th>
                    <th className="text-right py-2">পরিমাণ</th>
                    <th className="text-right py-2">বিক্রি</th>
                    <th className="text-right py-2">লাভ</th>
                  </tr>
                </thead>
                <tbody>
                  {pnl.topProducts.map((p, i) => (
                    <tr key={i} className="border-b border-border/20">
                      <td className="py-2">{p.name}</td>
                      <td className="text-right py-2 font-mono">{p.qty}</td>
                      <td className="text-right py-2 font-mono">
                        {fmtMoney(p.revenue)}
                      </td>
                      <td
                        className={`text-right py-2 font-mono ${
                          p.profit >= 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {fmtMoney(p.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-4 text-center">
              এই সময়ে কোনো বিক্রয় নেই
            </div>
          )}
        </div>

        <div className="card-premium p-5">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="h-4 w-4 text-warning" />
            <h3 className="font-semibold text-base">সাম্প্রতিক খরচ</h3>
          </div>
          {pnl && pnl.expenseRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border/40">
                    <th className="text-left py-2">বিবরণ</th>
                    <th className="text-right py-2">পরিমাণ</th>
                  </tr>
                </thead>
                <tbody>
                  {pnl.expenseRows.map((e, i) => (
                    <tr key={i} className="border-b border-border/20">
                      <td className="py-2">{e.description}</td>
                      <td className="text-right py-2 font-mono">
                        {fmtMoney(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="pt-2 text-xs text-muted-foreground">
                      মোট খরচ
                    </td>
                    <td className="pt-2 text-right font-mono font-semibold">
                      {fmtMoney(pnl.expenses)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-4 text-center">
              এই সময়ে কোনো খরচ নেই
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "destructive" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "warning"
          ? "text-warning"
          : "";
  return (
    <div className="rounded-lg border border-border/40 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className={`font-mono font-semibold ${toneClass}`}>{value}</div>
      {hint && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>
      )}
    </div>
  );
}
