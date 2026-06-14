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

export async function fetchDashboard() {
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
  icon: Icon, label, value, accent, cardBg, cardFg,
}: { icon: any; label: string; value: string; accent?: string; cardBg?: string; cardFg?: string }) {
  const base = cardBg
    ? `rounded-xl border border-border shadow-[var(--shadow-card)] p-8 ${cardBg}`
    : "card-premium p-8";
  return (
    <div className={base}>
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-base uppercase tracking-widest ${cardFg ? cardFg : "text-muted-foreground"}`}>{label}</div>
          <div className={`text-4xl font-display font-semibold mt-4 ${cardFg ?? ""}`}>{value}</div>
        </div>
        <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${accent ?? "bg-primary/15 text-primary"}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { t } = useI18n();
  const { data: d } = useSuspenseQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader title={t("dashboard")} subtitle="Real-time pulse of your business." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Stat icon={CalendarDays} label={t("salesToday")} value={fmtMoney(d.salesToday)} cardBg="bg-card-blue" cardFg="text-card-blue-fg" accent="bg-card-blue-fg/15 text-card-blue-fg" />
        <Stat icon={CalendarRange} label={t("salesMonth")} value={fmtMoney(d.salesMonth)} cardBg="bg-card-green" cardFg="text-card-green-fg" accent="bg-card-green-fg/15 text-card-green-fg" />
        <Stat icon={TrendingUp} label={t("salesYear")} value={fmtMoney(d.salesYear)} cardBg="bg-card-purple" cardFg="text-card-purple-fg" accent="bg-card-purple-fg/15 text-card-purple-fg" />
        <Stat icon={Wallet} label={t("dueReceivable")} value={fmtMoney(d.dueReceivable)} cardBg="bg-card-amber" cardFg="text-card-amber-fg" accent="bg-card-amber-fg/15 text-card-amber-fg" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <Stat icon={Package} label={t("totalProducts")} value={String(d.productCount)} cardBg="bg-card-teal" cardFg="text-card-teal-fg" accent="bg-card-teal-fg/15 text-card-teal-fg" />
        <Stat icon={Users} label={t("totalCustomers")} value={String(d.customerCount)} cardBg="bg-card-indigo" cardFg="text-card-indigo-fg" accent="bg-card-indigo-fg/15 text-card-indigo-fg" />
        <Stat icon={AlertTriangle} label={t("lowStock")} value={String(d.lowStockCount)} cardBg="bg-card-rose" cardFg="text-card-rose-fg" accent="bg-card-rose-fg/15 text-card-rose-fg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border shadow-[var(--shadow-card)] p-8 lg:col-span-2 bg-card-blue">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-base uppercase tracking-widest text-card-blue-fg/70">Last 14 days</div>
              <div className="font-display text-2xl font-semibold text-card-blue-fg">Sales trend</div>
            </div>
          </div>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.chart} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.55 0.16 230)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="oklch(0.55 0.16 230)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.55 0.08 230 / 20%)" />
                <XAxis dataKey="day" stroke="oklch(0.55 0.08 230 / 60%)" fontSize={12} />
                <YAxis stroke="oklch(0.55 0.08 230 / 60%)" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.98 0.01 230)", border: "1px solid oklch(0.85 0.05 230)", borderRadius: 8 }}
                  labelStyle={{ color: "oklch(0.4 0.1 230)" }}
                  itemStyle={{ color: "oklch(0.4 0.1 230)" }}
                />
                <Area type="monotone" dataKey="sales" stroke="oklch(0.55 0.16 230)" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border shadow-[var(--shadow-card)] p-7 bg-card-rose">
          <div className="font-display text-xl font-semibold mb-5 text-card-rose-fg">{t("lowStock")}</div>
          {d.lowStock.length === 0 ? (
            <p className="text-sm text-card-rose-fg/70">All good. Nothing low.</p>
          ) : (
            <ul className="space-y-3">
              {d.lowStock.map((p) => (
                <li key={p.id} className="flex justify-between items-center text-sm text-card-rose-fg">
                  <span className="truncate">{p.name}</span>
                  <span className="text-card-rose-fg font-mono font-semibold">{Number(p.stock)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border shadow-[var(--shadow-card)] p-7 mt-5 bg-card-purple">
        <div className="flex items-center justify-between mb-5">
          <div className="font-display text-xl font-semibold flex items-center gap-2 text-card-purple-fg">
            <Receipt className="h-5 w-5 text-card-purple-fg" /> {t("recentSales")}
          </div>
        </div>
        {d.recent.length === 0 ? (
          <p className="text-sm text-card-purple-fg/70">{t("noData")}</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-sm text-card-purple-fg">
                <thead className="text-xs uppercase tracking-wider text-card-purple-fg/60">
                  <tr className="text-left border-b border-card-purple-fg/15">
                    <th className="py-2 pr-4">{t("invoice")}</th>
                    <th className="py-2 pr-4">{t("date")}</th>
                    <th className="py-2 pr-4">Method</th>
                    <th className="py-2 pr-4 text-right">{t("total")}</th>
                    <th className="py-2 text-right">{t("due")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map((s) => (
                    <tr key={s.id} className="border-b border-card-purple-fg/10">
                      <td className="py-3 pr-4 font-mono">{s.invoice_no}</td>
                      <td className="py-3 pr-4 text-card-purple-fg/70">{fmtDateTime(s.created_at)}</td>
                      <td className="py-3 pr-4 capitalize">{s.payment_method}</td>
                      <td className="py-3 pr-4 text-right font-mono">{fmtMoney(s.total)}</td>
                      <td className="py-3 text-right font-mono text-card-amber-fg">{Number(s.due) > 0 ? fmtMoney(s.due) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="md:hidden space-y-2">
              {d.recent.map((s) => (
                <li key={s.id} className="border border-card-purple-fg/15 rounded-lg p-3 space-y-1.5 bg-white/40">
                  <div className="flex items-center justify-between gap-2 text-card-purple-fg">
                    <span className="font-mono text-sm font-medium truncate">{s.invoice_no}</span>
                    <span className="font-mono text-sm font-semibold">{fmtMoney(s.total)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-card-purple-fg/70">
                    <span className="truncate">{fmtDateTime(s.created_at)} · {s.payment_method}</span>
                    {Number(s.due) > 0 && <span className="text-card-amber-fg shrink-0">{t("due")}: {fmtMoney(s.due)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

      </div>
    </div>
  );
}
