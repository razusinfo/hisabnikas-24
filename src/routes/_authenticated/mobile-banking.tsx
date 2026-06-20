import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/DateInput";
import { fmtMoney, fmtDate } from "@/lib/format";
import {
  Smartphone,
  TrendingUp,
  Wallet,
  ArrowDownCircle,
  Search,
  Download,
  Printer,
  Info,
  Calendar,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/mobile-banking")({
  component: MobileBankingDashboard,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">{(error as Error).message}</div>
  ),
  notFoundComponent: () => <div className="p-4">Not found</div>,
});

type Method = "bkash" | "nagad" | "rocket" | "upay" | "other" | "all";

const METHOD_LABELS: Record<Exclude<Method, "all">, { label: string; color: string }> = {
  bkash: { label: "বিকাশ", color: "#e2136e" },
  nagad: { label: "নগদ", color: "#ec1c24" },
  rocket: { label: "রকেট", color: "#8c198e" },
  upay: { label: "উপায়", color: "#f7941d" },
  other: { label: "অন্যান্য", color: "#64748b" },
};

function classifyMethod(raw: string | null | undefined): Exclude<Method, "all"> {
  const s = (raw ?? "").toLowerCase().trim();
  if (s.includes("bkash") || s.includes("বিকাশ")) return "bkash";
  if (s.includes("nagad") || s.includes("নগদ")) return "nagad";
  if (s.includes("rocket") || s.includes("রকেট")) return "rocket";
  if (s.includes("upay") || s.includes("উপায়") || s === "tap") return "upay";
  if (s.includes("mobile") || s.includes("mfs")) return "other";
  return "other";
}

const MOBILE_HINTS = ["bkash", "nagad", "rocket", "upay", "tap", "mobile", "বিকাশ", "নগদ", "রকেট", "উপায়", "mfs"];

function isMobileMethod(raw: string | null | undefined) {
  const s = (raw ?? "").toLowerCase();
  return MOBILE_HINTS.some((h) => s.includes(h));
}

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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

type Preset = "today" | "week" | "month" | "custom";

function MobileBankingDashboard() {
  const [method, setMethod] = useState<Method>("all");
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState<string>(monthStartISO());
  const [to, setTo] = useState<string>(todayISO());
  const [search, setSearch] = useState("");

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p === "today") {
      setFrom(todayISO());
      setTo(todayISO());
    } else if (p === "week") {
      setFrom(daysAgoISO(6));
      setTo(todayISO());
    } else if (p === "month") {
      setFrom(monthStartISO());
      setTo(todayISO());
    }
  }

  const q = useQuery({
    queryKey: ["mobile-banking-entries", from, to],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cashbook")
        .select("id,entry_date,type,category,description,amount,method,note,created_at")
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  const all = q.data ?? [];
  const mobileEntries = useMemo(() => all.filter((e) => isMobileMethod(e.method)), [all]);

  const filtered = useMemo(() => {
    let rows = mobileEntries;
    if (method !== "all") {
      rows = rows.filter((e) => classifyMethod(e.method) === method);
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      rows = rows.filter(
        (e) =>
          (e.description ?? "").toLowerCase().includes(s) ||
          (e.method ?? "").toLowerCase().includes(s) ||
          (e.category ?? "").toLowerCase().includes(s) ||
          (e.note ?? "").toLowerCase().includes(s),
      );
    }
    return rows;
  }, [mobileEntries, method, search]);

  // KPIs
  const totalTxn = filtered.length;
  const collected = filtered
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const paidOut = filtered
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const net = collected - paidOut;

  // Method-wise breakdown (income side — collections)
  const methodBreakdown = useMemo(() => {
    const map = new Map<Exclude<Method, "all">, { count: number; collected: number; paid: number }>();
    for (const e of mobileEntries) {
      const m = classifyMethod(e.method);
      const cur = map.get(m) ?? { count: 0, collected: 0, paid: 0 };
      cur.count += 1;
      if (e.type === "income") cur.collected += Number(e.amount || 0);
      else cur.paid += Number(e.amount || 0);
      map.set(m, cur);
    }
    return (["bkash", "nagad", "rocket", "upay", "other"] as const).map((m) => ({
      m,
      ...(map.get(m) ?? { count: 0, collected: 0, paid: 0 }),
    }));
  }, [mobileEntries]);

  const totalCollectedAll = methodBreakdown.reduce((s, r) => s + r.collected, 0);

  // Daily trend (last N days in range)
  const dailyTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of mobileEntries) {
      if (e.type !== "income") continue;
      const k = e.entry_date;
      map.set(k, (map.get(k) ?? 0) + Number(e.amount || 0));
    }
    const days: { date: string; amount: number }[] = [];
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      days.push({ date: k, amount: map.get(k) ?? 0 });
    }
    return days.slice(-30);
  }, [mobileEntries, from, to]);
  const trendMax = Math.max(1, ...dailyTrend.map((d) => d.amount));

  // Compare with Cash / Bank / Card from full dataset
  const compare = useMemo(() => {
    const buckets = { cash: 0, mobile: 0, bank: 0, card: 0, other: 0 };
    for (const e of all) {
      if (e.type !== "income") continue;
      const m = (e.method ?? "").toLowerCase();
      const amt = Number(e.amount || 0);
      if (isMobileMethod(m)) buckets.mobile += amt;
      else if (m.includes("cash") || m.includes("নগদ অর্থ") || m === "নগদ-cash") buckets.cash += amt;
      else if (m.includes("bank") || m.includes("cheque") || m.includes("ব্যাংক")) buckets.bank += amt;
      else if (m.includes("card")) buckets.card += amt;
      else buckets.other += amt;
    }
    return buckets;
  }, [all]);
  const compareTotal = Object.values(compare).reduce((s, v) => s + v, 0) || 1;

  function exportCSV() {
    const header = ["Date", "Description", "Category", "Method", "Type", "Amount"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          r.entry_date,
          `"${(r.description ?? "").replace(/"/g, '""')}"`,
          `"${(r.category ?? "").replace(/"/g, '""')}"`,
          `"${(r.method ?? "").replace(/"/g, '""')}"`,
          r.type,
          r.amount,
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mobile-banking-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <PageHeader
        title="মোবাইল ব্যাংকিং ড্যাশবোর্ড"
        subtitle="বিকাশ, নগদ, রকেট, উপায় সহ সকল মোবাইল ব্যাংকিং কালেকশন বিশ্লেষণ"
      />

      {/* Filters */}
      <Card className="p-4 mb-4 space-y-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          {(["today", "week", "month", "custom"] as Preset[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={preset === p ? "default" : "outline"}
              onClick={() => applyPreset(p)}
            >
              <Calendar className="h-3.5 w-3.5 mr-1" />
              {p === "today" ? "আজ" : p === "week" ? "৭ দিন" : p === "month" ? "এই মাস" : "কাস্টম"}
            </Button>
          ))}
          {preset === "custom" && (
            <>
              <DateInput value={from} onChange={setFrom} />
              <DateInput value={to} onChange={setTo} />
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={method === "all" ? "default" : "outline"}
            onClick={() => setMethod("all")}
          >
            সব মাধ্যম
          </Button>
          {(Object.keys(METHOD_LABELS) as Array<keyof typeof METHOD_LABELS>).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={method === m ? "default" : "outline"}
              onClick={() => setMethod(m)}
              style={method === m ? { backgroundColor: METHOD_LABELS[m].color, borderColor: METHOD_LABELS[m].color } : undefined}
            >
              {METHOD_LABELS[m].label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="বিবরণ, ক্যাটাগরি বা মাধ্যম খুঁজুন"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Excel/CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> প্রিন্ট
          </Button>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi
          icon={<Smartphone className="h-5 w-5" />}
          label="মোট লেনদেন"
          value={totalTxn.toLocaleString("bn-BD")}
          tone="primary"
        />
        <Kpi
          icon={<TrendingUp className="h-5 w-5" />}
          label="মোট কালেকশন"
          value={fmtMoney(collected, "bn")}
          tone="positive"
        />
        <Kpi
          icon={<ArrowDownCircle className="h-5 w-5" />}
          label="পরিশোধ"
          value={fmtMoney(paidOut, "bn")}
          tone="negative"
        />
        <Kpi
          icon={<Wallet className="h-5 w-5" />}
          label="নিট প্রাপ্তি"
          value={fmtMoney(net, "bn")}
          tone={net >= 0 ? "positive" : "negative"}
        />
      </div>

      {/* Method breakdown */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">মাধ্যম অনুযায়ী কালেকশন</div>
          <Badge variant="outline">{fmtDate(from, "bn")} — {fmtDate(to, "bn")}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {methodBreakdown.map((r) => {
            const pct = totalCollectedAll > 0 ? (r.collected / totalCollectedAll) * 100 : 0;
            const info = METHOD_LABELS[r.m];
            return (
              <div key={r.m} className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ background: info.color }} />
                    <span className="font-semibold text-sm">{info.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{r.count.toLocaleString("bn-BD")} টি</span>
                </div>
                <div className="text-base font-bold">{fmtMoney(r.collected, "bn")}</div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${pct}%`, background: info.color }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {pct.toFixed(1)}% শেয়ার
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Daily trend */}
      <Card className="p-4 mb-4">
        <div className="font-semibold mb-3">দৈনিক কালেকশন ট্রেন্ড</div>
        {dailyTrend.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">কোনো ডেটা নেই</div>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {dailyTrend.map((d) => {
              const h = (d.amount / trendMax) * 100;
              return (
                <div
                  key={d.date}
                  className="flex-1 group relative flex flex-col justify-end min-w-0"
                  title={`${d.date}: ${fmtMoney(d.amount, "bn")}`}
                >
                  <div
                    className="bg-primary/80 hover:bg-primary rounded-t transition-all"
                    style={{ height: `${Math.max(2, h)}%` }}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>{dailyTrend[0]?.date}</span>
          <span>{dailyTrend[dailyTrend.length - 1]?.date}</span>
        </div>
      </Card>

      {/* Payment method comparison */}
      <Card className="p-4 mb-4">
        <div className="font-semibold mb-3">Payment Method তুলনা (সকল আয়)</div>
        <div className="space-y-2">
          {[
            { k: "cash", label: "Cash", color: "#22c55e" },
            { k: "mobile", label: "Mobile Banking", color: "#e2136e" },
            { k: "bank", label: "Bank Transfer", color: "#3b82f6" },
            { k: "card", label: "Card", color: "#a855f7" },
            { k: "other", label: "অন্যান্য", color: "#64748b" },
          ].map((row) => {
            const v = (compare as any)[row.k] as number;
            const pct = (v / compareTotal) * 100;
            return (
              <div key={row.k}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{row.label}</span>
                  <span className="font-mono">
                    {fmtMoney(v, "bn")} · {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full" style={{ width: `${pct}%`, background: row.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Transactions table */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">লেনদেনের বিস্তারিত</div>
          <Badge variant="outline">{filtered.length.toLocaleString("bn-BD")} টি</Badge>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left p-2">তারিখ</th>
                <th className="text-left p-2">বিবরণ</th>
                <th className="text-left p-2">ক্যাটাগরি</th>
                <th className="text-left p-2">মাধ্যম</th>
                <th className="text-center p-2">ধরন</th>
                <th className="text-right p-2">পরিমাণ</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center p-6 text-muted-foreground">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-6 text-muted-foreground">
                    কোনো লেনদেন পাওয়া যায়নি
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 500).map((r) => {
                  const m = classifyMethod(r.method);
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-2 whitespace-nowrap">{fmtDate(r.entry_date, "bn")}</td>
                      <td className="p-2">{r.description || "—"}</td>
                      <td className="p-2 text-muted-foreground">{r.category || "—"}</td>
                      <td className="p-2">
                        <Badge
                          variant="outline"
                          style={{ borderColor: METHOD_LABELS[m].color, color: METHOD_LABELS[m].color }}
                        >
                          {METHOD_LABELS[m].label}
                        </Badge>
                      </td>
                      <td className="p-2 text-center">
                        <Badge variant={r.type === "income" ? "default" : "destructive"}>
                          {r.type === "income" ? "জমা" : "উত্তোলন"}
                        </Badge>
                      </td>
                      <td
                        className={`p-2 text-right font-mono font-semibold ${r.type === "income" ? "text-emerald-600" : "text-destructive"}`}
                      >
                        {fmtMoney(Number(r.amount), "bn")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {filtered.length > 500 && (
            <div className="text-xs text-muted-foreground text-center mt-2">
              প্রথম ৫০০টি দেখানো হচ্ছে। সম্পূর্ণ তালিকার জন্য Export করুন।
            </div>
          )}
        </div>
      </Card>

      {/* Advanced features notice */}
      <Card className="p-4 border-dashed">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <div className="font-semibold">আরও উন্নত ফিচার (পরবর্তী আপডেটে)</div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              <b>Settlement Tracking, Reconciliation (POS vs MFS), Refund Report, Charge/Fee Report,
              Branch & Cashier-wise, Transaction Status (Pending/Failed), QR Payment, Commission</b> —
              এই ফিচারগুলো চালু করতে হলে ডেটাবেসে অতিরিক্ত ফিল্ড (transaction_id, charge,
              settlement_date, status, branch_id, cashier_id ইত্যাদি) যোগ করতে হবে। বলুন কোনগুলো
              আপনার জন্য সবচেয়ে দরকার — সেগুলো আগে চালু করে দিচ্ছি।
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "primary" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 bg-emerald-500/10"
      : tone === "negative"
        ? "text-destructive bg-destructive/10"
        : "text-primary bg-primary/10";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${toneClass}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-bold truncate">{value}</div>
        </div>
      </div>
    </Card>
  );
}
