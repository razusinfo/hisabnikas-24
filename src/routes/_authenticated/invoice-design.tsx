import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Lock, Printer, Share2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInvoicePreview } from "@/components/InvoicePreviewProvider";


export const Route = createFileRoute("/_authenticated/invoice-design")({
  component: InvoiceDesignPage,
});

import {
  INVOICE_FONT_FAMILIES,
  INVOICE_FONT_WEIGHTS,
  getInvoiceFontCss,
  type InvoiceFontKey,
  type InvoiceFontWeight,
} from "@/lib/invoice-fonts";

type DesignSettings = {
  invoiceTheme?: string;
  invoiceFontSize?: "sm" | "md" | "lg" | "xl";
  invoiceTemplate?: number;
  invoiceFontFamily?: InvoiceFontKey;
  invoiceFontWeight?: InvoiceFontWeight;
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
  const { showInvoicePreview } = useInvoicePreview();

  const tr = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", "me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, company_name, logo_url, phone, address, invoice_settings")
        .eq("id", u.user.id)
        .single();
      if (error) throw error;
      return data ? { ...data, email: u.user.email || null } : null;
    },
  });

  const subQuery = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("subscriptions")
        .select("plan, expires_at")
        .eq("user_id", u.user.id)
        .maybeSingle();
      return data;
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Sync package status across tabs, on login, and via realtime updates
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
    };

    const subscribeRealtime = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (cancelled || !u.user) return;
      channel = supabase
        .channel(`sub-status-${u.user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${u.user.id}` },
          () => invalidate(),
        )
        .subscribe();
    };
    subscribeRealtime();

    // Cross-tab sync
    const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("package-status") : null;
    if (bc) bc.onmessage = () => invalidate();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "package-status-updated") invalidate();
    };
    window.addEventListener("storage", onStorage);

    // Refetch on visibility change (covers tabs returning to foreground)
    const onVisible = () => {
      if (document.visibilityState === "visible") invalidate();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Refetch after login / token refresh
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        invalidate();
        if (!channel) subscribeRealtime();
      }
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (bc) bc.close();
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
      authSub.subscription.unsubscribe();
    };
  }, [qc]);

  const isPackageActive = (() => {
    const s = subQuery.data;
    if (!s) return false;
    if (s.plan === "trial") return false;
    if (!s.expires_at) return false;
    return new Date(s.expires_at).getTime() > Date.now();
  })();


  const [theme, setTheme] = useState<string>(THEMES[0]);
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg" | "xl">("md");
  const [template, setTemplate] = useState<number>(1);
  const [fontFamily, setFontFamily] = useState<InvoiceFontKey>("serif");
  const [fontWeight, setFontWeight] = useState<InvoiceFontWeight>(700);
  const [lockedOpen, setLockedOpen] = useState(false);
  const [lockedTitle, setLockedTitle] = useState("");

  useEffect(() => {
    const s = (profileQuery.data?.invoice_settings ?? {}) as DesignSettings;
    if (s.invoiceTheme) setTheme(s.invoiceTheme);
    if (s.invoiceFontSize) setFontSize(s.invoiceFontSize);
    if (s.invoiceTemplate) setTemplate(s.invoiceTemplate);
    if (s.invoiceFontFamily) setFontFamily(s.invoiceFontFamily);
    if (s.invoiceFontWeight) setFontWeight(s.invoiceFontWeight);
  }, [profileQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!profileQuery.data) throw new Error("No profile");
      const prev = (profileQuery.data.invoice_settings ?? {}) as Record<string, unknown>;
      const next = { ...prev, invoiceTheme: theme, invoiceFontSize: fontSize, invoiceTemplate: template, invoiceFontFamily: fontFamily, invoiceFontWeight: fontWeight };
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

  const showUpgradeToast = () =>
    toast.error(tr("এই ফিচারটি ব্যবহার করতে প্যাকেজ আপগ্রেড করুন", "Upgrade your package to use this feature"));

  const persist = (patch: Partial<DesignSettings>, skipCheck?: boolean) => {
    if (!profile) return;
    if (!skipCheck && !isPackageActive) {
      setLockedTitle(tr("প্যাকেজ প্রয়োজন", "Package Required"));
      setLockedOpen(true);
      return;
    }
    const prev = (profile.invoice_settings ?? {}) as Record<string, unknown>;
    const next = {
      ...prev,
      invoiceTheme: patch.invoiceTheme ?? theme,
      invoiceFontSize: patch.invoiceFontSize ?? fontSize,
      invoiceTemplate: patch.invoiceTemplate ?? template,
      invoiceFontFamily: patch.invoiceFontFamily ?? fontFamily,
      invoiceFontWeight: patch.invoiceFontWeight ?? fontWeight,
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

  const [testSeed, setTestSeed] = useState(0);

  const SAMPLE_CUSTOMERS = [
    { name: tr("রহিম উদ্দিন", "Rahim Uddin"), phone: "01711-234567", address: tr("ধানমন্ডি, ঢাকা", "Dhanmondi, Dhaka") },
    { name: tr("করিমা বেগম", "Karima Begum"), phone: "01819-998877", address: tr("চট্টগ্রাম", "Chittagong") },
    { name: tr("ABC ট্রেডার্স", "ABC Traders"), phone: "01976-543210", address: tr("মতিঝিল, ঢাকা", "Motijheel, Dhaka") },
    { name: tr("সুমন এন্টারপ্রাইজ", "Sumon Enterprise"), phone: "01511-112233", address: tr("সিলেট", "Sylhet") },
    { name: tr("মেসার্স জাহিদ স্টোর", "M/s Jahid Store"), phone: "01622-778899", address: tr("রাজশাহী", "Rajshahi") },
  ];

  const SAMPLE_PRODUCTS = [
    { name: tr("বাসমতি চাল ৫ কেজি", "Basmati Rice 5kg"), price: 850 },
    { name: tr("সয়াবিন তেল ১ লিটার", "Soybean Oil 1L"), price: 175 },
    { name: tr("ডিটারজেন্ট পাউডার ১ কেজি", "Detergent Powder 1kg"), price: 220 },
    { name: tr("চা পাতা ৫০০ গ্রাম", "Tea Leaves 500g"), price: 320 },
    { name: tr("লাল চিনি ১ কেজি", "Brown Sugar 1kg"), price: 140 },
    { name: tr("মসুর ডাল ১ কেজি", "Lentil 1kg"), price: 135 },
    { name: tr("সরিষার তেল ৫০০ মিলি", "Mustard Oil 500ml"), price: 195 },
    { name: tr("আটা ২ কেজি", "Flour 2kg"), price: 130 },
    { name: tr("লবণ ১ কেজি", "Salt 1kg"), price: 40 },
    { name: tr("হলুদ গুঁড়া ২০০ গ্রাম", "Turmeric Powder 200g"), price: 85 },
  ];

  const buildSampleInvoice = () => {
    // Pseudo-random seed-based picker so each click yields a new invoice
    const rnd = (n: number, salt: number) =>
      Math.abs(Math.sin((testSeed + 1) * (salt + 1) * 12.9898) * 43758.5453) % n;

    const customer = SAMPLE_CUSTOMERS[Math.floor(rnd(SAMPLE_CUSTOMERS.length, 1))];
    const itemCount = 3 + Math.floor(rnd(5, 2)); // 3-7 items
    const picked = new Set<number>();
    const items = Array.from({ length: itemCount }, (_, i) => {
      let idx = Math.floor(rnd(SAMPLE_PRODUCTS.length, i + 3));
      while (picked.has(idx)) idx = (idx + 1) % SAMPLE_PRODUCTS.length;
      picked.add(idx);
      const p = SAMPLE_PRODUCTS[idx];
      const qty = 1 + Math.floor(rnd(5, i + 10));
      return { name: p.name, qty, price: p.price, total: p.price * qty };
    });
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const discount = Math.round(subtotal * 0.05);
    const tax = Math.round((subtotal - discount) * 0.05);
    const deliveryCharge = 60;
    const previousDue = Math.floor(rnd(2000, 7));
    const total = subtotal - discount + tax + deliveryCharge;
    const paid = Math.round(total * (0.4 + (rnd(60, 8) / 100))); // 40-100% paid
    const due = Math.max(0, total - paid) + previousDue;
    const invoiceNo = `INV-${String(1000 + testSeed).padStart(4, "0")}`;

    const settingsForPrint = {
      ...((profile?.invoice_settings ?? {}) as Record<string, unknown>),
      invoiceTheme: theme,
      invoiceFontSize: fontSize,
      invoiceTemplate: template,
      invoiceFontFamily: fontFamily,
      invoiceFontWeight: fontWeight,
    };

    return {
      doc: {
        invoice_no: invoiceNo,
        created_at: new Date().toISOString(),
        partyName: customer.name,
        partyPhone: customer.phone,
        method: customer.address,
        note: tr(
          "ধন্যবাদ আমাদের সাথে ব্যবসা করার জন্য।",
          "Thank you for doing business with us.",
        ),
        subtotal,
        total,
        paid,
        due,
        items,
        previousDue,
        discount,
        tax,
        deliveryCharge,
      },
      business: {
        name: profile?.company_name ?? "Your Business",
        owner: profile?.full_name ?? "",
        address: profile?.address ?? "",
        phone: profile?.phone ?? null,
        email: (profile as any)?.email ?? null,
        logoUrl: profile?.logo_url ?? null,
      },
      settings: settingsForPrint,
      lang: (lang === "bn" ? "bn" : "en") as "bn" | "en",
      labels: {
        invoice: tr("ইনভয়েস", "Invoice"),
        date: tr("তারিখ", "Date"),
        customer: tr("ক্রেতার নাম:", "Customer Name"),
        phone: tr("ফোন", "Phone"),
        method: tr("ঠিকানা:", "Address:"),
        item: tr("পণ্য", "Item"),
        price: tr("মূল্য", "Price"),
        qty: tr("পরিমাণ", "Qty"),
        total: tr("মোট", "Total"),
        subtotal: tr("সাব টোটাল", "Subtotal"),
        paid: tr("পরিশোধ", "Paid"),
        due: tr("বকেয়া", "Due"),
        note: tr("নোট", "Note"),
        statusPaid: tr("পরিশোধিত", "Paid"),
        statusDue: tr("বকেয়া", "Due"),
        statusPartial: tr("আংশিক", "Partial"),
        signature: tr("স্বাক্ষর", "Signature"),
        previousDue: tr("পূর্বের বকেয়া", "Previous Due"),
        discount: tr("ছাড়", "Discount"),
        tax: tr("ট্যাক্স/ভ্যাট", "Tax/VAT"),
        deliveryCharge: tr("ডেলিভারি চার্জ", "Delivery"),
        terms: tr("শর্তাবলী", "Terms"),
        notes: tr("নোট", "Notes"),
        bankDetails: tr("ব্যাংক বিবরণ", "Bank Details"),
        paymentInstructions: tr("পেমেন্ট নির্দেশনা", "Payment Instructions"),
      },
    };
  };

  const doPrint = () => {
    showInvoicePreview(buildSampleInvoice());
  };

  const doGenerateTest = () => {
    setTestSeed((s) => s + 1);
    // Defer so state updates before building
    setTimeout(() => showInvoicePreview(buildSampleInvoice()), 0);
    toast.success(tr("নতুন টেস্ট ইনভয়েস তৈরি হয়েছে", "New test invoice generated"));
  };


  const doShare = async () => {
    const url = window.location.href;
    const title = tr("ইনভয়েস ডিজাইন প্রিভিউ", "Invoice Design Preview");
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(tr("লিংক কপি হয়েছে", "Link copied"));
      }
    } catch {
      /* user cancelled */
    }
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
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => doGenerateTest()}
          >
            <Sparkles className="h-4 w-4" /> {tr("টেস্ট ইনভয়েস তৈরি করুন", "Generate Test Invoice")}
          </Button>
          <Button
            className="gap-2 text-white"
            style={{ backgroundColor: theme }}
            onClick={() => doPrint()}
          >
            <Printer className="h-4 w-4" /> {tr("প্রিন্ট", "Print")}
          </Button>
          <Button
            className="gap-2 text-white"
            style={{ backgroundColor: theme }}
            onClick={() => doShare()}
          >
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
            fontFamily={fontFamily}
            fontWeight={fontWeight}
            companyName={profile?.company_name ?? "Your Business"}
            phone={profile?.phone ?? ""}
            email={(profile as any)?.email ?? ""}
            logoUrl={profile?.logo_url ?? null}
            lang={lang}
          />
          </CardContent>
        </Card>

        {/* Right: Options */}
        <div className="space-y-6 relative">
          {!isPackageActive && !subQuery.isLoading && (
            <Card className="p-4 text-center space-y-2 shadow-sm border-primary/30 mb-4">
              <div className="flex items-center justify-center gap-2 text-primary font-semibold">
                <Lock className="h-4 w-4" />
                {tr("সক্রিয় প্যাকেজ প্রয়োজন", "Active Package Required")}
              </div>
              <div className="text-sm text-muted-foreground">
                {tr(
                  "প্রিমিয়াম ডিজাইন ফিচার ব্যবহার করতে প্যাকেজ ক্রয় করুন।",
                  "Purchase a package to use premium design features.",
                )}
              </div>
              <Button asChild size="sm">
                <Link to="/current-package">
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  {tr("প্যাকেজ কিনুন", "Buy Package")}
                </Link>
              </Button>
            </Card>
          )}

          <section>
            <h3 className="text-base font-semibold mb-3">{tr("রঙ", "Color")}</h3>
            <div className="grid grid-cols-6 gap-3">
              {THEMES.map((c, idx) => {
                const isLocked = idx !== 0 && !isPackageActive;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (isLocked) {
                        setLockedTitle(tr("রঙ", "Color"));
                        setLockedOpen(true);
                        return;
                      }
                      setTheme(c); persist({ invoiceTheme: c }, true);
                    }}
                    style={{ backgroundColor: c }}
                    className={cn(
                      "relative h-12 rounded-lg flex items-center justify-center transition ring-offset-2 overflow-hidden",
                      theme === c ? "ring-2 ring-offset-background ring-foreground/40 scale-105" : "hover:scale-105"
                    )}
                    aria-label={c}
                  >
                    {theme === c && <Check className="h-5 w-5 text-white" />}
                    {isLocked && (
                      <>
                        <div className="absolute top-0 right-0 z-10 pointer-events-none">
                          <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[8px] font-bold py-0.5 w-16 text-center shadow-sm rotate-45 translate-x-5 -translate-y-0.5">
                            প্যাকেজ
                          </div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center z-[1]">
                          <Lock className="h-4 w-4 text-foreground/70" />
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold mb-3">{tr("ফন্ট সাইজ", "Font Size")}</h3>
            <div className="grid grid-cols-4 gap-3">
              {FONT_SIZES.map((f, idx) => {
                const active = fontSize === f.value;
                const isLocked = idx !== 0 && !isPackageActive;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => {
                      if (isLocked) {
                        setLockedTitle(tr("ফন্ট সাইজ", "Font Size"));
                        setLockedOpen(true);
                        return;
                      }
                      setFontSize(f.value); persist({ invoiceFontSize: f.value }, true);
                    }}
                    style={active ? { backgroundColor: theme, color: "#fff" } : undefined}
                    className={cn(
                      "relative h-11 rounded-lg border text-sm font-medium transition overflow-hidden",
                      active ? "border-transparent" : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    <span className={cn(isLocked && "opacity-40")}>{f.label[lang === "bn" ? "bn" : "en"]}</span>
                    {isLocked && (
                      <>
                        <div className="absolute top-0 right-0 z-10 pointer-events-none">
                          <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[8px] font-bold py-0.5 w-16 text-center shadow-sm rotate-45 translate-x-5 -translate-y-0.5">
                            প্যাকেজ
                          </div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center z-[1]">
                          <Lock className="h-4 w-4 text-foreground/70" />
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold mb-3">{tr("ফন্ট স্টাইল", "Font Style")}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {INVOICE_FONT_FAMILIES.map((f, idx) => {
                const active = fontFamily === f.value;
                const isLocked = idx !== 0 && !isPackageActive;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => {
                      if (isLocked) {
                        setLockedTitle(tr("ফন্ট স্টাইল", "Font Style"));
                        setLockedOpen(true);
                        return;
                      }
                      setFontFamily(f.value); persist({ invoiceFontFamily: f.value }, true);
                    }}
                    style={active ? { backgroundColor: theme, color: "#fff", fontFamily: f.css } : { fontFamily: f.css }}
                    className={cn(
                      "relative h-14 rounded-lg border text-sm font-semibold transition flex items-center justify-center px-2 text-center overflow-hidden",
                      active ? "border-transparent" : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    <span className={cn(isLocked && "opacity-40")}>{f.label[lang === "bn" ? "bn" : "en"]}</span>
                    {isLocked && (
                      <>
                        <div className="absolute top-0 right-0 z-10 pointer-events-none">
                          <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[8px] font-bold py-0.5 w-16 text-center shadow-sm rotate-45 translate-x-5 -translate-y-0.5">
                            প্যাকেজ
                          </div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center z-[1]">
                          <Lock className="h-4 w-4 text-foreground/70" />
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold mb-3">{tr("ফন্ট ওয়েট", "Font Weight")}</h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {INVOICE_FONT_WEIGHTS.map((w) => {
                const active = fontWeight === w.value;
                return (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => {
                      if (!isPackageActive) {
                        setLockedTitle(tr("ফন্ট ওয়েট", "Font Weight"));
                        setLockedOpen(true);
                        return;
                      }
                      setFontWeight(w.value); persist({ invoiceFontWeight: w.value });
                    }}
                    style={active && isPackageActive
                      ? { backgroundColor: theme, color: "#fff", fontWeight: w.value, fontFamily: getInvoiceFontCss(fontFamily) }
                      : { fontWeight: w.value, fontFamily: getInvoiceFontCss(fontFamily) }}
                    className={cn(
                      "relative h-12 rounded-lg border text-sm transition flex items-center justify-center px-1 text-center overflow-hidden",
                      active && isPackageActive ? "border-transparent" : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    <span className={cn(!isPackageActive && "opacity-40")}>{w.label[lang === "bn" ? "bn" : "en"]}</span>
                    {!isPackageActive && (
                      <>
                        <div className="absolute top-0 right-0 z-10 pointer-events-none">
                          <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[8px] font-bold py-0.5 w-16 text-center shadow-sm rotate-45 translate-x-5 -translate-y-0.5">
                            প্যাকেজ
                          </div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center z-[1]">
                          <Lock className="h-4 w-4 text-foreground/70" />
                        </div>
                      </>
                    )}
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
                    onClick={() => {
                      if (!isPackageActive) {
                        setLockedTitle(tr("টেমপ্লেট", "Template"));
                        setLockedOpen(true);
                        return;
                      }
                      setTemplate(n); persist({ invoiceTemplate: n });
                    }}
                    className={cn(
                      "relative rounded-lg border-2 p-2 transition text-center space-y-2 bg-background overflow-hidden",
                      active && isPackageActive ? "shadow-md" : "border-border hover:border-foreground/30"
                    )}
                    style={active && isPackageActive ? { borderColor: theme } : undefined}
                  >
                    <div className={cn("aspect-[3/4] rounded overflow-hidden border bg-white", !isPackageActive && "opacity-40")}>
                      <TemplateThumbnail n={n} theme={theme} />
                    </div>
                    <div
                      className={cn("text-sm font-medium", !isPackageActive && "opacity-40")}
                      style={active && isPackageActive ? { color: theme } : undefined}
                    >
                      {tr("টেমপ্লেট", "Template")} {lang === "bn" ? toBn(n) : n}
                    </div>
                    {!isPackageActive && (
                      <>
                        <div className="absolute top-0 right-0 z-10 pointer-events-none">
                          <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-bold py-1 w-24 text-center shadow-md rotate-45 translate-x-8 translate-y-1">
                            প্যাকেজ
                          </div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center z-[1]">
                          <Lock className="h-5 w-5 text-foreground/70" />
                        </div>
                      </>
                    )}
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

      <Dialog open={lockedOpen} onOpenChange={setLockedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 h-14 w-14 rounded-full bg-amber-50 flex items-center justify-center">
              <Lock className="h-7 w-7 text-amber-600" />
            </div>
            <DialogTitle className="text-center">
              {lang === "bn" ? "এই ফিচারটি প্যাকেজের অন্তর্ভুক্ত" : "This feature is part of a package"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {lang === "bn"
                ? `"${lockedTitle}" ব্যবহার করতে অনুগ্রহ করে প্যাকেজ ক্রয় করুন। প্যাকেজ ক্রয়ের পর আপনি এই ফিচারসহ অন্যান্য প্রিমিয়াম ডিজাইন অপশন ব্যবহার করতে পারবেন।`
                : `To use "${lockedTitle}", please purchase a package. After purchase, you will get access to this feature and other premium design options.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" onClick={() => setLockedOpen(false)}>
              {lang === "bn" ? "বন্ধ করুন" : "Close"}
            </Button>
            <Button asChild>
              <Link to="/current-package" onClick={() => setLockedOpen(false)}>
                {lang === "bn" ? "প্যাকেজ ক্রয় করুন" : "Buy Package"}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  theme, fontSize, template, fontFamily, fontWeight, companyName, phone, email, logoUrl, lang,
}: {
  theme: string;
  fontSize: "sm" | "md" | "lg" | "xl";
  template: number;
  fontFamily: InvoiceFontKey;
  fontWeight: InvoiceFontWeight;
  companyName: string;
  phone: string;
  email: string;
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
    { bn: "মূল্য", en: "Price" },
    { bn: "পরিমাণ", en: "Qty" },
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
              <div style={{ fontSize: f.title, fontWeight, color: titleColor, lineHeight: 1.1, fontFamily: getInvoiceFontCss(fontFamily) }} className="whitespace-nowrap">
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
              {email && (
                <div style={{ fontSize: f.base - 1, color: subColor }}>
                  Email: {email}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Meta description */}
        <div className="mt-3 space-y-1" style={{ fontSize: f.base - 1 }}>
          <div className="flex justify-between">
            <div><span className="font-semibold">{tr("চালান নং", "Invoice #")}:</span> 5093758370499</div>
            <div><span className="font-semibold">{tr("তারিখ", "Date")}:</span> ১১/১০/২০২৩</div>
          </div>
          <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: f.base - 2 }}>
            <span><span className="font-semibold">{tr("ক্রেতার নাম:", "Customer Name:")}</span> Demo Party</span>
            <span className="text-gray-400">|</span>
            <span><span className="font-semibold">{tr("ফোন", "Phone")}:</span> 01XXXXXXXXX</span>
            <span className="text-gray-400">|</span>
            <span><span className="font-semibold">{tr("ঠিকানা:", "Address:")}</span> {tr("ধানমন্ডি, ঢাকা", "Dhanmondi, Dhaka")}</span>
          </div>
        </div>

        {/* Table */}
        <table className="w-full mt-4 border-collapse" style={{ fontSize: f.base - 1 }}>
          <thead>
            <tr style={{ background: theme, color: "#fff" }}>
              {headers.map((h, i) => (
                <th key={i} className={cn("p-2 font-semibold", i === 2 || i === 3 || i === 4 ? "text-right" : "text-left")} style={{ borderRight: i < headers.length - 1 ? "1px solid rgba(255,255,255,0.2)" : undefined }}>
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
                <td className="p-2 text-right">৳{r.price.toFixed(2)}</td>
                <td className="p-2 text-right">{r.qty}</td>
                <td className="p-2 text-right">৳{r.total.toFixed(2)}</td>
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
