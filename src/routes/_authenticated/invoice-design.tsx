import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Printer, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/invoice-design")({
  component: InvoiceDesignPage,
});

type DesignSettings = {
  invoiceTheme?: string;
  invoiceFontSize?: "sm" | "md" | "lg" | "xl";
  invoiceTemplate?: number;
};

const THEMES = [
  "#7C5CFB", "#E03E3E", "#E5A300", "#1FA84A", "#9B4DCA", "#1FB5B5",
  "#9C3B3B", "#E07A1F", "#5C6470", "#6FB6E5", "#2E3548", "#2342B5",
];

const FONT_SIZES: { value: "sm" | "md" | "lg" | "xl"; label: { bn: string; en: string } }[] = [
  { value: "sm", label: { bn: "ছোট", en: "Small" } },
  { value: "md", label: { bn: "মাঝারি", en: "Medium" } },
  { value: "lg", label: { bn: "বড়", en: "Large" } },
  { value: "xl", label: { bn: "অতিরিক্ত বড়", en: "Extra Large" } },
];

const TEMPLATES = Array.from({ length: 9 }, (_, i) => i + 1);

function InvoiceDesignPage() {
  const { t, lang } = useI18n();
  const tr = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", "me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, company_name, logo_url, phone, address, invoice_settings")
        .eq("id", u.user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [theme, setTheme] = useState<string>(THEMES[0]);
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg" | "xl">("md");
  const [template, setTemplate] = useState<number>(1);

  useEffect(() => {
    const s = (profileQuery.data?.invoice_settings ?? {}) as DesignSettings;
    if (s.invoiceTheme) setTheme(s.invoiceTheme);
    if (s.invoiceFontSize) setFontSize(s.invoiceFontSize);
    if (s.invoiceTemplate) setTemplate(s.invoiceTemplate);
  }, [profileQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!profileQuery.data) throw new Error("No profile");
      const prev = (profileQuery.data.invoice_settings ?? {}) as Record<string, unknown>;
      const next = { ...prev, invoiceTheme: theme, invoiceFontSize: fontSize, invoiceTemplate: template };
      const { error } = await supabase
        .from("profiles")
        .update({ invoice_settings: next as never })
        .eq("id", profileQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tr("সেভ হয়েছে", "Saved"));
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const profile = profileQuery.data;

  // Auto-save on change (debounced via mutate—simple approach: save on button + on each change)
  // We'll save on change to feel "live"
  const persist = (patch: Partial<DesignSettings>) => {
    if (!profile) return;
    const prev = (profile.invoice_settings ?? {}) as Record<string, unknown>;
    const next = {
      ...prev,
      invoiceTheme: patch.invoiceTheme ?? theme,
      invoiceFontSize: patch.invoiceFontSize ?? fontSize,
      invoiceTemplate: patch.invoiceTemplate ?? template,
    };
    supabase
      .from("profiles")
      .update({ invoice_settings: next as never })
      .eq("id", profile.id)
      .then(({ error }) => {
        if (error) toast.error(error.message);
        else qc.invalidateQueries({ queryKey: ["profile", "me"] });
      });
  };

  if (profileQuery.isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/settings"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <PageHeader title={tr("ইনভয়েস প্রিভিউ", "Invoice Preview")} />
        </div>
        <div className="flex items-center gap-2">
          <Button className="gap-2" style={{ backgroundColor: theme }}>
            <Printer className="h-4 w-4" /> {tr("প্রিন্ট", "Print")}
          </Button>
          <Button className="gap-2" style={{ backgroundColor: theme }}>
            <Share2 className="h-4 w-4" /> {tr("শেয়ার করুন", "Share")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Invoice preview */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <InvoicePreview
              theme={theme}
              fontSize={fontSize}
              template={template}
              companyName={profile?.company_name ?? "Your Business"}
              phone={profile?.phone ?? ""}
              logoUrl={profile?.logo_url ?? null}
              lang={lang}
            />
          </CardContent>
        </Card>

        {/* Right: Options */}
        <div className="space-y-6">
          <section>
            <h3 className="text-base font-semibold mb-3">{tr("রঙ", "Color")}</h3>
            <div className="grid grid-cols-6 gap-3">
              {THEMES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setTheme(c); persist({ invoiceTheme: c }); }}
                  style={{ backgroundColor: c }}
                  className={cn(
                    "h-12 rounded-lg flex items-center justify-center transition ring-offset-2",
                    theme === c ? "ring-2 ring-offset-background ring-foreground/40 scale-105" : "hover:scale-105"
                  )}
                  aria-label={c}
                >
                  {theme === c && <Check className="h-5 w-5 text-white" />}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold mb-3">{tr("ফন্ট সাইজ", "Font Size")}</h3>
            <div className="grid grid-cols-4 gap-3">
              {FONT_SIZES.map((f) => {
                const active = fontSize === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => { setFontSize(f.value); persist({ invoiceFontSize: f.value }); }}
                    style={active ? { backgroundColor: theme, color: "#fff" } : undefined}
                    className={cn(
                      "h-11 rounded-lg border text-sm font-medium transition",
                      active ? "border-transparent" : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    {f.label[lang === "bn" ? "bn" : "en"]}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold mb-3">{tr("টেমপ্লেট", "Template")}</h3>
            <div className="grid grid-cols-3 gap-4">
              {TEMPLATES.map((n) => {
                const active = template === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setTemplate(n); persist({ invoiceTemplate: n }); }}
                    className={cn(
                      "rounded-lg border-2 p-2 transition text-center space-y-2 bg-background",
                      active ? "shadow-md" : "border-border hover:border-foreground/30"
                    )}
                    style={active ? { borderColor: theme } : undefined}
                  >
                    <div className="aspect-[3/4] rounded overflow-hidden border bg-white">
                      <TemplateThumbnail n={n} theme={theme} />
                    </div>
                    <div
                      className="text-sm font-medium"
                      style={active ? { color: theme } : undefined}
                    >
                      {tr("টেমপ্লেট", "Template")} {lang === "bn" ? toBn(n) : n}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              style={{ backgroundColor: theme }}
              className="text-white"
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {tr("সেভ করুন", "Save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function toBn(n: number): string {
  const map = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n).split("").map((d) => map[Number(d)] ?? d).join("");
}

/* ---------------- Invoice Preview ---------------- */

const FONT_SIZE_MAP = {
  sm: { base: 11, title: 18, head: 13 },
  md: { base: 13, title: 22, head: 15 },
  lg: { base: 15, title: 26, head: 17 },
  xl: { base: 17, title: 30, head: 19 },
} as const;

function InvoicePreview({
  theme, fontSize, template, companyName, phone, logoUrl, lang,
}: {
  theme: string;
  fontSize: "sm" | "md" | "lg" | "xl";
  template: number;
  companyName: string;
  phone: string;
  logoUrl: string | null;
  lang: string;
}) {
  const f = FONT_SIZE_MAP[fontSize];
  const tr = (bn: string, en: string) => (lang === "bn" ? bn : en);

  // Header container variations per template
  const headerWrap: React.CSSProperties = (() => {
    switch (template) {
      case 2: return { background: theme, color: "#fff", padding: 14, borderRadius: 6 };
      case 3: return { borderTop: `4px solid ${theme}`, paddingTop: 12 };
      case 4: return { background: `${theme}12`, padding: 14, borderLeft: `4px solid ${theme}` };
      case 5: return { borderBottom: `2px dashed ${theme}`, paddingBottom: 10 };
      case 6: return { background: theme, color: "#fff", padding: 14, clipPath: "polygon(0 0,100% 0,100% 82%,0 100%)" };
      case 7: return { padding: 10, border: `2px solid ${theme}` };
      case 8: return { background: `linear-gradient(135deg, ${theme}, ${theme}aa)`, color: "#fff", padding: 14, borderRadius: 6 };
      case 9: return { borderBottom: `3px double ${theme}`, paddingBottom: 10 };
      default: return { borderBottom: `1px solid ${theme}55`, paddingBottom: 10 };
    }
  })();

  const headerInverse = [2, 6, 8].includes(template);
  const titleColor = headerInverse ? "#fff" : theme;
  const subColor = headerInverse ? "rgba(255,255,255,0.9)" : "#444";

  const rows = Array.from({ length: 7 }, (_, i) => ({
    no: i + 1, name: `Demo Product ${i + 1}`, qty: 1, price: 250, total: 250,
  }));

  const headers = [
    { bn: "ক্রম", en: "#" },
    { bn: "পণ্যের নাম", en: "Item" },
    { bn: "পরিমাণ", en: "Qty" },
    { bn: "মূল্য", en: "Price" },
    { bn: "মোট", en: "Total" },
  ];

  return (
    <div className="relative p-6 bg-white text-black overflow-hidden" style={{ fontSize: f.base }}>
      {/* watermark */}
      {logoUrl && (
        <img
          src={logoUrl}
          alt=""
          className="pointer-events-none absolute inset-0 m-auto opacity-10 object-contain"
          style={{ width: "55%", height: "55%" }}
        />
      )}

      <div className="relative">
        {/* Header */}
        <div style={headerWrap}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 w-1/4">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-14 w-14 object-contain rounded" />
              ) : (
                <div
                  className="h-14 w-14 rounded flex items-center justify-center font-bold"
                  style={{ background: headerInverse ? "rgba(255,255,255,0.2)" : `${theme}20`, color: titleColor }}
                >
                  LOGO
                </div>
              )}
            </div>
            <div className="flex-1 text-center flex flex-col items-center justify-center">
              <div style={{ fontSize: f.title, fontWeight: 800, color: titleColor, lineHeight: 1.1 }} className="whitespace-nowrap">
                {companyName}
              </div>
              <div style={{ fontSize: f.base - 1, color: subColor, marginTop: 2 }}>
                {tr("ঠিকানা এখানে লিখুন", "Address goes here")}
              </div>
              {phone && (
                <div style={{ fontSize: f.base - 1, color: subColor }}>
                  {tr("ফোন", "Phone")}: {phone}
                </div>
              )}
            </div>
            <div className="text-right w-1/4" style={{ color: headerInverse ? "#fff" : "#000" }}>
              <div style={{ fontSize: f.base - 1, color: subColor }}>
                তারিখ:১৬/০৬/২০২৬
              </div>
              <div style={{ fontSize: f.head + 4, fontWeight: 800, color: titleColor, letterSpacing: 1 }}>
                {tr("ইনভয়েস", "INVOICE")}
              </div>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="mt-3 grid grid-cols-2 gap-y-1" style={{ fontSize: f.base - 1 }}>
          <div><span className="font-semibold">{tr("ইনভয়েস নং", "Invoice #")}:</span> 5093758370499</div>
          <div className="text-right">তারিখ:১১/১০/২০২৩</div>
          <div><span className="font-semibold">{tr("কাস্টমার", "Customer")}:</span> Demo Party</div>
          <div><span className="font-semibold">{tr("ফোন", "Phone")}:</span> 01XXXXXXXXX</div>
        </div>

        {/* Table */}
        <table className="w-full mt-4 border-collapse" style={{ fontSize: f.base - 1 }}>
          <thead>
            <tr style={{ background: theme, color: "#fff" }}>
              {headers.map((h, i) => (
                <th key={i} className="text-left p-2 font-semibold" style={{ borderRight: i < headers.length - 1 ? "1px solid rgba(255,255,255,0.2)" : undefined }}>
                  {lang === "bn" ? h.bn : h.en}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.no} style={{ background: idx % 2 ? `${theme}08` : "transparent" }} className="border-b border-gray-100">
                <td className="p-2">{r.no}</td>
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.qty}</td>
                <td className="p-2">৳{r.price.toFixed(2)}</td>
                <td className="p-2">৳{r.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Notes + Totals */}
        <div className="mt-4 grid grid-cols-2 gap-6" style={{ fontSize: f.base - 1 }}>
          <div className="space-y-2">
            <div>
              <div className="font-semibold">{tr("বর্ণনা", "Description")}</div>
              <div className="text-gray-700">
                {tr("এই ইনভয়েসটি কেবলমাত্র ডেমোনেস্ট্রেশনের জন্য তৈরি করা হয়েছে", "This invoice is created for demonstration only")}
              </div>
            </div>
            <div>
              <div className="font-semibold">{tr("পেমেন্টের ধরন", "Payment Type")}</div>
              <div className="text-gray-700">bKash</div>
              <div className="text-gray-700">{tr("লেনদেন আইডি", "Txn ID")}: XXXXXXXX</div>
              <div className="text-gray-700">{tr("ফোন নং", "Phone")}: 01XXXXXXXXX</div>
            </div>
          </div>
          <div className="space-y-1">
            <Line label={tr("সাব টোটাল", "Sub total")} value="৳1,750.00" />
            <Line label={tr("ডেলিভারি চার্জ", "Delivery")} value="৳120.00" />
            <Line label={tr("মোট পরিশোধ", "Total Paid")} value="৳1,768.75" />
            <Line label={tr("মোট বকেয়া", "Due")} value="৳1,648.75" />
            <div style={{ borderTop: `1px solid ${theme}`, marginTop: 4, paddingTop: 4 }}>
              <Line label={tr("বর্তমান পাওনা", "Current Balance")} value="৳2,148.75" bold color={theme} />
            </div>
          </div>
        </div>

        {/* Note line */}
        <div className="mt-4 text-gray-700" style={{ fontSize: f.base - 1 }}>
          {tr("কথায়: এক হাজার সাত শত আটাত্তর টাকা পঁচাত্তর পয়সা মাত্র", "In words: One thousand seven hundred seventy-eight taka seventy-five paisa only")}
        </div>

        {/* Signatures */}
        <div className="mt-10 flex justify-between items-end" style={{ fontSize: f.base - 1 }}>
          <div className="border-t border-gray-400 pt-1 w-40 text-center">{tr("ক্রেতার স্বাক্ষর", "Customer Signature")}</div>
          <div className="border-t border-gray-400 pt-1 w-40 text-center">{tr("অনুমোদনকারীর স্বাক্ষর", "Authorized Signature")}</div>
        </div>

        {/* Footer terms */}
        <div className="mt-6 pt-3 border-t" style={{ borderColor: `${theme}40`, fontSize: f.base - 2 }}>
          <div className="font-semibold" style={{ color: theme }}>{tr("শর্তাবলী", "Terms & Conditions")}</div>
          <div className="text-gray-600">
            {tr(
              "পণ্য ৭ দিনের মধ্যে আসল প্যাকেজিং সহ ফেরত দেওয়া যাবে। সহজে নষ্ট হওয়া পণ্য ফেরতযোগ্য নয়।",
              "Products can be returned within 7 days in their original, unopened condition. Perishable goods cannot be returned."
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className="flex justify-between" style={{ fontWeight: bold ? 700 : 400, color: color }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/* ---------------- Template thumbnails ---------------- */

function TemplateThumbnail({ n, theme }: { n: number; theme: string }) {
  const headerVariants: Record<number, React.CSSProperties> = {
    1: { borderBottom: `2px solid ${theme}` },
    2: { background: theme },
    3: { borderTop: `3px solid ${theme}` },
    4: { background: `${theme}25`, borderLeft: `3px solid ${theme}` },
    5: { borderBottom: `2px dashed ${theme}` },
    6: { background: theme, clipPath: "polygon(0 0, 100% 0, 100% 75%, 0 100%)" },
    7: { border: `1.5px solid ${theme}` },
    8: { background: `linear-gradient(135deg, ${theme}, ${theme}aa)` },
    9: { borderBottom: `3px double ${theme}` },
  };
  return (
    <div className="w-full h-full p-2 flex flex-col gap-1 text-[6px]">
      <div style={headerVariants[n]} className="px-2 py-1.5 flex items-center justify-between">
        <div className="font-bold" style={{ color: [2, 6, 8].includes(n) ? "#fff" : "#000" }}>LOGO</div>
        <div className="font-bold" style={{ color: [2, 6, 8].includes(n) ? "#fff" : theme }}>INVOICE</div>
      </div>
      <div className="flex justify-between px-1 mt-1 text-[5px] text-gray-700">
        <span>Customer</span><span>Date</span>
      </div>
      <div className="border rounded mt-1 px-1 py-0.5" style={{ borderColor: `${theme}40` }}>
        <div className="flex gap-1 text-[5px] font-semibold" style={{ color: theme }}>
          <span className="flex-1">Item</span><span>Qty</span><span>Price</span>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-1 text-[5px] text-gray-600">
            <span className="flex-1">Demo {i + 1}</span><span>1</span><span>250</span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex justify-end text-[5px] font-bold" style={{ color: theme }}>
        Total: ৳1,768
      </div>
    </div>
  );
}
