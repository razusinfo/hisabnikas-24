import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtDateTime } from "@/lib/format";
import {
  TrendingUp,
  Package,
  Users,
  AlertTriangle,
  Wallet,
  CalendarRange,
  CalendarDays,
  Receipt,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["dashboard"],
      queryFn: fetchDashboard,
    });
  },
  component: Dashboard,
});

async function fetchDashboard() {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const last14 = new Date(now); last14.setDate(now.getDate() - 13);

  const [sales, products, customers] = await Promise.all([
    supabase.from("sales").select("id,total,due,created_at,invoice_no,customer_id,payment_method").gte("created_at", startOfYear.toISOString()).order("created_at", { ascending: false }),
    supabase.from("products").select("id,name,stock,low_stock_threshold,sell_price"),
    supabase.from("customers").select("id,due_balance"),
  ]);

  const allSales = sales.data ?? [];
  const today = allSales.filter((s) => new Date(s.created_at) >= startOfDay);
  const month = allSales.filter((s) => new Date(s.created_at) >= startOfMonth);

  // 14-day chart
  const byDay = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(last14); d.setDate(last14.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  allSales.forEach((s) => {
    const k = new Date(s.created_at).toISOString().slice(0, 10);
    if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + Number(s.total));
  });
  const chart = Array.from(byDay.entries()).map(([d, v]) => ({
    day: new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" }),
    sales: Number(v.toFixed(2)),
  }));

  const lowStock = (products.data ?? []).filter((p) => Number(p.stock) <= Number(p.low_stock_threshold));
  const dueReceivable = (customers.data ?? []).reduce((s, c) => s + Number(c.due_balance ?? 0), 0);

  return {
    salesToday: today.reduce((s, x) => s + Number(x.total), 0),
    salesMonth: month.reduce((s, x) => s + Number(x.total), 0),
    salesYear: allSales.reduce((s, x) => s + Number(x.total), 0),
    productCount: products.data?.length ?? 0,
    customerCount: customers.data?.length ?? 0,
    lowStockCount: lowStock.length,
    lowStock: lowStock.slice(0, 5),
    dueReceivable,
    recent: allSales.slice(0, 6),
    chart,
  };
}

function Stat({
  icon: Icon, label, value, accent,
}: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <div className="card-premium p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="text-2xl font-display font-semibold mt-2">{value}</div>
        </div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent ?? "bg-primary/15 text-primary"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { t } = useI18n();
  const { data: d } = useSuspenseQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader title={t("dashboard")} subtitle="Real-time pulse of your business." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={CalendarDays} label={t("salesToday")} value={fmtMoney(d.salesToday)} />
        <Stat icon={CalendarRange} label={t("salesMonth")} value={fmtMoney(d.salesMonth)} accent="bg-success/15 text-success" />
        <Stat icon={TrendingUp} label={t("salesYear")} value={fmtMoney(d.salesYear)} accent="bg-chart-4/15 text-chart-4" />
        <Stat icon={Wallet} label={t("dueReceivable")} value={fmtMoney(d.dueReceivable)} accent="bg-warning/15 text-warning" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat icon={Package} label={t("totalProducts")} value={String(d.productCount)} />
        <Stat icon={Users} label={t("totalCustomers")} value={String(d.customerCount)} />
        <Stat icon={AlertTriangle} label={t("lowStock")} value={String(d.lowStockCount)} accent="bg-destructive/15 text-destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card-premium p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Last 14 days</div>
              <div className="font-display text-lg font-semibold">Sales trend</div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.chart} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.82 0.14 200)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.82 0.14 200)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 240 / 30%)" />
                <XAxis dataKey="day" stroke="oklch(0.65 0.012 240)" fontSize={11} />
                <YAxis stroke="oklch(0.65 0.012 240)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.17 0.007 240)", border: "1px solid oklch(0.25 0.008 240)", borderRadius: 8 }}
                  labelStyle={{ color: "oklch(0.85 0.005 240)" }}
                />
                <Area type="monotone" dataKey="sales" stroke="oklch(0.82 0.14 200)" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-premium p-6">
          <div className="font-display text-lg font-semibold mb-4">{t("lowStock")}</div>
          {d.lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">All good. Nothing low.</p>
          ) : (
            <ul className="space-y-3">
              {d.lowStock.map((p) => (
                <li key={p.id} className="flex justify-between items-center text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="text-destructive font-mono">{Number(p.stock)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card-premium p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="font-display text-lg font-semibold flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> {t("recentSales")}
          </div>
        </div>
        {d.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noData")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="text-left border-b border-border">
                  <th className="py-2 pr-4">{t("invoice")}</th>
                  <th className="py-2 pr-4">{t("date")}</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4 text-right">{t("total")}</th>
                  <th className="py-2 text-right">{t("due")}</th>
                </tr>
              </thead>
              <tbody>
                {d.recent.map((s) => (
                  <tr key={s.id} className="border-b border-border/40">
                    <td className="py-3 pr-4 font-mono">{s.invoice_no}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{fmtDateTime(s.created_at)}</td>
                    <td className="py-3 pr-4 capitalize">{s.payment_method}</td>
                    <td className="py-3 pr-4 text-right font-mono">{fmtMoney(s.total)}</td>
                    <td className="py-3 text-right font-mono text-warning">{Number(s.due) > 0 ? fmtMoney(s.due) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
