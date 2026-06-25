import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtDateTime } from "@/lib/format";
import { InstallAppBanner } from "@/components/InstallAppBanner";
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
  const chart = Array.from(byDay.entries()).map(([d, v]) => {
    const dt = new Date(d);
    return {
      day: `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`,
      sales: Number(v.toFixed(2)),
    };
  });

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

const cardThemes = [
  { bg: "bg-sky-50", border: "border-sky-200", iconBg: "bg-sky-100", iconText: "text-sky-600" },
  { bg: "bg-emerald-50", border: "border-emerald-200", iconBg: "bg-emerald-100", iconText: "text-emerald-600" },
  { bg: "bg-violet-50", border: "border-violet-200", iconBg: "bg-violet-100", iconText: "text-violet-600" },
  { bg: "bg-amber-50", border: "border-amber-200", iconBg: "bg-amber-100", iconText: "text-amber-600" },
  { bg: "bg-rose-50", border: "border-rose-200", iconBg: "bg-rose-100", iconText: "text-rose-600" },
  { bg: "bg-cyan-50", border: "border-cyan-200", iconBg: "bg-cyan-100", iconText: "text-cyan-600" },
  { bg: "bg-orange-50", border: "border-orange-200", iconBg: "bg-orange-100", iconText: "text-orange-600" },
];

function Stat({
  icon: Icon, label, value, themeIndex, to,
}: { icon: any; label: string; value: string; themeIndex: number; to?: string }) {
  const t = cardThemes[themeIndex % cardThemes.length];
  const content = (
    <div className={`${t.bg} border ${t.border} rounded-xl shadow-sm p-4 ${to ? "transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="text-xl font-display font-semibold mt-2">{value}</div>
        </div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${t.iconBg} ${t.iconText}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
  if (to) return <Link to={to} className="block">{content}</Link>;
  return content;
}

function Dashboard() {
  const { t } = useI18n();
  const { data: d } = useSuspenseQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t("dashboard")}
        subtitle="Real-time pulse of your business."
      />


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <Stat icon={CalendarDays} label={t("salesToday")} value={fmtMoney(d.salesToday)} themeIndex={0} to="/sales" />
        <Stat icon={CalendarRange} label={t("salesMonth")} value={fmtMoney(d.salesMonth)} themeIndex={1} to="/sales" />
        <Stat icon={TrendingUp} label={t("salesYear")} value={fmtMoney(d.salesYear)} themeIndex={2} to="/sales" />
        <Stat icon={Wallet} label={t("dueReceivable")} value={fmtMoney(d.dueReceivable)} themeIndex={3} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <Stat icon={Package} label={t("totalProducts")} value={String(d.productCount)} themeIndex={4} />
        <Stat icon={Users} label={t("totalCustomers")} value={String(d.customerCount)} themeIndex={5} />
        <Stat icon={AlertTriangle} label={t("lowStock")} value={String(d.lowStockCount)} themeIndex={6} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card-premium p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="font-display text-lg font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> {t("recentSales")}
            </div>
          </div>
          {d.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noData")}</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="overflow-x-auto hidden md:block">
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
              {/* Mobile cards */}
              <ul className="md:hidden space-y-2">
                {d.recent.map((s) => (
                  <li key={s.id} className="border border-border/40 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-medium truncate">{s.invoice_no}</span>
                      <span className="font-mono text-sm font-semibold">{fmtMoney(s.total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate">{fmtDateTime(s.created_at)} · {s.payment_method}</span>
                      {Number(s.due) > 0 && <span className="text-warning shrink-0">{t("due")}: {fmtMoney(s.due)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="card-premium p-5">
          <div className="font-display text-lg font-semibold mb-4">{t("lowStock")}</div>
          {d.lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">All good. Nothing low.</p>
          ) : (
            <ul className="space-y-2">
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

      <div className="card-premium p-5 mt-4">
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
    </div>
  );
}
