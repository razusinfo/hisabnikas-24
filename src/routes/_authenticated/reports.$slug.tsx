import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from "date-fns";
import { ArrowLeft, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { REPORTS, type ReportCol } from "@/lib/reports-registry";

export const Route = createFileRoute("/_authenticated/reports/$slug")({
  beforeLoad: ({ params }) => {
    if (!REPORTS[params.slug]) throw notFound();
  },
  component: ReportDetailPage,
  notFoundComponent: () => (
    <div className="p-8 text-center text-muted-foreground">রিপোর্ট পাওয়া যায়নি।</div>
  ),
});

type Preset = "today" | "week" | "month" | "custom";

function rangeFor(preset: Preset, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date();
  const f = (d: Date) => format(d, "yyyy-MM-dd");
  if (preset === "today") return { from: f(today), to: f(today) };
  if (preset === "week") return { from: f(startOfWeek(today, { weekStartsOn: 6 })), to: f(endOfWeek(today, { weekStartsOn: 6 })) };
  if (preset === "month") return { from: f(startOfMonth(today)), to: f(endOfMonth(today)) };
  return { from: customFrom, to: customTo };
}

function ReportDetailPage() {
  const { slug } = Route.useParams();
  const { lang } = useI18n();
  const bn = lang === "bn";
  const config = REPORTS[slug];

  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState(monthStart);
  const [customTo, setCustomTo] = useState(today);

  const { from, to } = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const query = useQuery({
    queryKey: ["report", slug, from, to],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Not authenticated");
      return config.fetch(uid, from, to);
    },
  });

  const presets: { key: Preset; label: string; labelEn: string }[] = [
    { key: "today", label: "আজ", labelEn: "Today" },
    { key: "week", label: "এই সপ্তাহ", labelEn: "This Week" },
    { key: "month", label: "এই মাস", labelEn: "This Month" },
    { key: "custom", label: "কাস্টম", labelEn: "Custom" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2">
          <Link to="/reports">
            <ArrowLeft className="h-4 w-4" />
            {bn ? "রিপোর্টস" : "Reports"}
          </Link>
        </Button>
      </div>

      <PageHeader
        title={bn ? config.title : config.titleEn}
        subtitle={bn ? config.description : config.descriptionEn}
      />

      {config.usesDateFilter && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={preset === p.key ? "default" : "outline"}
                  onClick={() => setPreset(p.key)}
                >
                  {bn ? p.label : p.labelEn}
                </Button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">{bn ? "শুরু" : "From"}</Label>
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{bn ? "শেষ" : "To"}</Label>
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9" />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {bn ? "নির্বাচিত পরিসর: " : "Selected range: "} {from} → {to}
            </p>
          </CardContent>
        </Card>
      )}

      {query.isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> {bn ? "লোড হচ্ছে..." : "Loading..."}
        </div>
      )}

      {query.isError && (
        <Card><CardContent className="p-6 text-sm text-red-600">
          {(query.error as Error).message}
        </CardContent></Card>
      )}

      {query.data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {query.data.summary.map((s, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{bn ? s.label : s.labelEn}</div>
                  <div className={`text-xl font-semibold mt-1 ${s.tone === "positive" ? "text-emerald-600" : s.tone === "negative" ? "text-rose-600" : ""}`}>
                    {formatValue(s.value, s.format ?? "number", bn)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {query.data.columns.map((c) => (
                      <th key={c.key} className={`px-3 py-2 font-medium text-muted-foreground whitespace-nowrap ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`}>
                        {bn ? c.label : c.labelEn}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {query.data.rows.length === 0 && (
                    <tr><td colSpan={query.data.columns.length} className="px-3 py-10 text-center text-muted-foreground">
                      {bn ? "কোন তথ্য পাওয়া যায়নি।" : "No data found."}
                    </td></tr>
                  )}
                  {query.data.rows.map((row, i) => (
                    <tr key={i} className="border-t border-border/60">
                      {query.data!.columns.map((c) => (
                        <td key={c.key} className={`px-3 py-2 whitespace-nowrap ${c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : ""}`}>
                          {renderCell(row[c.key], c, bn)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function formatValue(v: unknown, fmt: "currency" | "number" | "date" | "datetime" | "text", bn: boolean): string {
  if (v === null || v === undefined || v === "") return "-";
  if (fmt === "currency") {
    const n = Number(v) || 0;
    return (bn ? "৳ " : "৳ ") + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  if (fmt === "number") {
    const n = Number(v) || 0;
    return n.toLocaleString();
  }
  if (fmt === "date") {
    const d = new Date(v as string);
    if (isNaN(d.getTime())) return String(v);
    return format(d, "dd MMM yyyy");
  }
  if (fmt === "datetime") {
    const d = new Date(v as string);
    if (isNaN(d.getTime())) return String(v);
    return format(d, "dd MMM yyyy HH:mm");
  }
  return String(v);
}

function renderCell(v: unknown, c: ReportCol, bn: boolean) {
  return formatValue(v, (c.format as any) ?? "text", bn);
}
