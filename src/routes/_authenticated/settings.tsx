import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Info, ExternalLink, Download, Smartphone, Copy, FileCode } from "lucide-react";
import { APP_VERSION } from "@/lib/app-version";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type AppSettings = {
  // Products
  productActive?: boolean;
  itemType?: "product" | "service";
  sku?: boolean;
  barcodeScan?: boolean;
  stockMaintenance?: boolean;
  stockValuationMethod?: "avg" | "fifo" | "lifo";
  itemUnit?: boolean;
  itemCategory?: boolean;
  showPurchasePrice?: boolean;
  discount?: boolean;
  vat?: boolean;
  manufactureDate?: boolean;
  expiryDate?: boolean;
  description?: boolean;
  showSalePrice?: boolean;
  wholesale?: boolean;
  mrpPrice?: boolean;
  batchNumber?: boolean;
  serialImei?: boolean;
  size?: boolean;
  warranty?: boolean;
  expiryAlert?: boolean;
  expiryAlertDays?: number;
  lowStockAlert?: boolean;
  lowStockQty?: number;
  // Transactions
  showInvoiceNumber?: boolean;
  cashSaleDefault?: boolean;
  txShowPurchasePrice?: boolean;
  txShowSalePrice?: boolean;
  deliveryCharge?: boolean;
  taxPerTx?: boolean;
  discountPerTx?: boolean;
  saleProfit?: boolean;
  allowViewInvoice?: boolean;
  discountOnPayment?: boolean;
  dueSmsOnTx?: boolean;
  inactiveSupplierOnSale?: boolean;
  inactiveCustomerOnPurchase?: boolean;
  autoIncrementInvoice?: boolean;
  startingInvoiceNumber?: number;
  // Export & printing
  showHeading?: boolean;
  showCompanyName?: boolean;
  showCompanyLogo?: boolean;
  showExportDate?: boolean;
  showBusinessInfo?: boolean;
  showPreviousDue?: boolean;
  showFooter?: boolean;
  showSignature?: boolean;
  showInvoiceTerms?: boolean;
  showInvoiceDescription?: boolean;
  useRegularPrinter?: boolean;
  useThermalPrinter?: boolean;
  // legacy keys preserved
  prefix?: string;
  nextNumber?: number;
  defaultTax?: number;
  defaultDiscount?: number;
  footer?: string;
  terms?: string;
  notes?: string;
  bankDetails?: string;
  paymentInstructions?: string;
};

type Profile = {
  id: string;
  language: string;
  currency: string;
  invoice_settings: AppSettings | null;
};

const CURRENCIES = [
  { code: "BDT", label: "৳ BDT — Bangladeshi Taka" },
  { code: "USD", label: "$ USD — US Dollar" },
  { code: "EUR", label: "€ EUR — Euro" },
  { code: "GBP", label: "£ GBP — British Pound" },
  { code: "INR", label: "₹ INR — Indian Rupee" },
  { code: "SAR", label: "﷼ SAR — Saudi Riyal" },
  { code: "AED", label: "د.إ AED — UAE Dirham" },
];

// Labels in Bengali (primary) with English fallback
const L = {
  // sections
  products: { bn: "পণ্য সমূহ", en: "Products" },
  transactions: { bn: "লেনদেন", en: "Transactions" },
  exportPrint: { bn: "এক্সপোর্ট ও প্রিন্টিং", en: "Export & Printing" },
  save: { bn: "সেভ করুন", en: "Save" },
  yes: { bn: "YES", en: "YES" },
  no: { bn: "NO", en: "NO" },
  go: { bn: "Go", en: "Go" },
  // products
  productActive: { bn: "সক্রিয়", en: "Active" },
  itemType: { bn: "আইটেমের ধরণ", en: "Item type" },
  product: { bn: "পণ্য", en: "Product" },
  service: { bn: "সেবা", en: "Service" },
  sku: { bn: "এসকিউ (SKU)", en: "SKU" },
  barcodeScan: { bn: "বারকোড স্ক্যান", en: "Barcode scan" },
  stockMaintenance: { bn: "স্টক মেইনটেনেন্স", en: "Stock maintenance" },
  stockValuationMethod: { bn: "স্টক মূল্য নির্ধারণের প্রক্রিয়া", en: "Stock valuation method" },
  avgPurchase: { bn: "গড় ক্রয়মূল্য", en: "Average cost" },
  fifo: { bn: "FIFO", en: "FIFO" },
  lifo: { bn: "LIFO", en: "LIFO" },
  itemUnit: { bn: "আইটেম ইউনিট", en: "Item unit" },
  itemCategory: { bn: "আইটেম ক্যাটাগরি", en: "Item category" },
  showPurchasePrice: { bn: "ক্রয় মূল্য দেখান", en: "Show purchase price" },
  discount: { bn: "ডিসকাউন্ট", en: "Discount" },
  vat: { bn: "ভ্যাট", en: "VAT" },
  manufactureDate: { bn: "উৎপাদন তারিখ", en: "Manufacture date" },
  expiryDate: { bn: "মেয়াদ উত্তীর্ণের তারিখ", en: "Expiry date" },
  description: { bn: "বর্ণনা", en: "Description" },
  showSalePrice: { bn: "বিক্রয় মূল্য দেখান", en: "Show sale price" },
  wholesale: { bn: "পাইকারি", en: "Wholesale" },
  mrpPrice: { bn: "এমআরপি / মূল্য", en: "MRP / Price" },
  batchNumber: { bn: "ব্যাচ নাম্বার", en: "Batch number" },
  serialImei: { bn: "ক্রমিক নং / আইএমইআই", en: "Serial / IMEI" },
  size: { bn: "আকার", en: "Size" },
  warranty: { bn: "ওয়ারেন্টি", en: "Warranty" },
  expiryAlert: { bn: "মেয়াদ উত্তীর্ণের এলার্ট", en: "Expiry alert" },
  expiryAlertDays: { bn: "মেয়াদ উত্তীর্ণের এলার্টের জন্য সর্বোচ্চ দিনের পরিমাণ", en: "Max days for expiry alert" },
  lowStockAlert: { bn: "স্টক শেষের এলার্ট", en: "Low stock alert" },
  lowStockQty: { bn: "এলার্টের জন্য সর্বোচ্চ স্টকের পরিমাণ", en: "Max stock qty for alert" },
  // transactions
  showInvoiceNumber: { bn: "ইনভয়েস নম্বর প্রদর্শন করুন", en: "Show invoice number" },
  cashSaleDefault: { bn: "নগদ বিক্রি স্বাভাবিকভাবে সক্রিয় রাখুন", en: "Keep cash sale active by default" },
  txShowPurchasePrice: { bn: "আইটেমের ক্রয় মূল্য দেখান", en: "Show item purchase price" },
  txShowSalePrice: { bn: "আইটেমের বিক্রয় মূল্য দেখান", en: "Show item sale price" },
  deliveryCharge: { bn: "ডেলিভারি চার্জ", en: "Delivery charge" },
  taxPerTx: { bn: "লেনদেন অনুযায়ী ট্যাক্স", en: "Tax per transaction" },
  discountPerTx: { bn: "লেনদেন অনুযায়ী ডিসকাউন্ট", en: "Discount per transaction" },
  saleProfit: { bn: "বিক্রয় ভিত্তিক লাভ প্রদর্শন করুন", en: "Show sale-based profit" },
  allowViewInvoice: { bn: "ইনভয়েস দেখার অনুমতি দিন", en: "Allow viewing invoice" },
  discountOnPayment: { bn: "পেমেন্টের সময় ডিসকাউন্ট", en: "Discount at payment time" },
  dueSmsOnTx: { bn: "লেনদেনের সময় বাকির এসএমএস পাঠান", en: "Send due SMS on transaction" },
  inactiveSupplierOnSale: { bn: "বিক্রয়ের সময় সাপ্লাইয়ার নিষ্ক্রিয় করুন", en: "Hide supplier on sale" },
  inactiveCustomerOnPurchase: { bn: "ক্রয়ের সময় কাস্টমার নিষ্ক্রিয় করুন", en: "Hide customer on purchase" },
  autoIncrementInvoice: { bn: "ইনভয়েস নম্বর স্বয়ংক্রিয়ভাবে বৃদ্ধি করুন", en: "Auto-increment invoice number" },
  startingInvoiceNumber: { bn: "প্রাথমিক ইনভয়েস নম্বর সেট করুন", en: "Set starting invoice number" },
  // export & printing
  showHeading: { bn: "শিরোনাম দেখান", en: "Show heading" },
  showCompanyName: { bn: "কোম্পানির নাম প্রদর্শন করুন", en: "Show company name" },
  showCompanyLogo: { bn: "কোম্পানির লোগো প্রদর্শন করুন", en: "Show company logo" },
  showExportDate: { bn: "এক্সপোর্টের তারিখ প্রদর্শন করুন", en: "Show export date" },
  showBusinessInfo: { bn: "ব্যবসা প্রতিষ্ঠানের তথ্য দেখান", en: "Show business info" },
  showPreviousDue: { bn: "পূর্বের বকেয়া দেখান", en: "Show previous due" },
  showFooter: { bn: "ফুটার দেখান", en: "Show footer" },
  showSignature: { bn: "স্বাক্ষর দেখান", en: "Show signature" },
  showInvoiceTerms: { bn: "ইনভয়েসে শর্তাবলী প্রদর্শন করুন", en: "Show invoice terms" },
  showInvoiceDescription: { bn: "ইনভয়েসে বর্ণনা প্রদর্শন করুন", en: "Show invoice description" },
  changeInvoiceDesign: { bn: "ইনভয়েসের ডিজাইন পরিবর্তন করুন", en: "Change invoice design" },
  useRegularPrinter: { bn: "রেগুলার প্রিন্টার ব্যবহার করুন", en: "Use regular printer" },
  useThermalPrinter: { bn: "থার্মাল প্রিন্টার ব্যবহার করুন", en: "Use thermal printer" },
  // preferences
  preferences: { bn: "পছন্দসমূহ", en: "Preferences" },
  language: { bn: "ভাষা", en: "Language" },
  currency: { bn: "মুদ্রা", en: "Currency" },
  changePassword: { bn: "পাসওয়ার্ড পরিবর্তন", en: "Change password" },
  newPassword: { bn: "নতুন পাসওয়ার্ড", en: "New password" },
  confirmPassword: { bn: "পাসওয়ার্ড নিশ্চিত করুন", en: "Confirm password" },
  updatePassword: { bn: "পাসওয়ার্ড আপডেট করুন", en: "Update password" },
};

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const tr = (k: keyof typeof L) => L[k][lang === "bn" ? "bn" : "en"];
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", "me"],
    queryFn: async (): Promise<Profile> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, language, currency, invoice_settings")
        .eq("id", u.user.id)
        .single();
      if (error) throw error;
      return data as unknown as Profile;
    },
  });

  const [currency, setCurrency] = useState("BDT");
  const [language, setLanguage] = useState<"en" | "bn">("en");
  const [s, setS] = useState<AppSettings>({});

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (profileQuery.data) {
      setCurrency(profileQuery.data.currency ?? "BDT");
      setLanguage((profileQuery.data.language as "en" | "bn") ?? "en");
      // sensible defaults to match screenshot
      const data = profileQuery.data.invoice_settings ?? {};
      setS({
        productActive: true,
        itemType: "product",
        stockValuationMethod: "avg",
        expiryAlertDays: 1,
        lowStockQty: 10,
        showInvoiceNumber: true,
        txShowSalePrice: true,
        saleProfit: true,
        allowViewInvoice: true,
        discountOnPayment: true,
        startingInvoiceNumber: 1000,
        showHeading: true,
        showCompanyName: true,
        showCompanyLogo: true,
        showExportDate: true,
        showBusinessInfo: true,
        showSignature: true,
        showInvoiceTerms: true,
        showInvoiceDescription: true,
        ...data,
      });
    }
  }, [profileQuery.data]);

  const saveAll = useMutation({
    mutationFn: async () => {
      if (!profileQuery.data) throw new Error("No profile");
      const { error } = await supabase
        .from("profiles")
        .update({
          currency,
          language,
          invoice_settings: s as never,
        })
        .eq("id", profileQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("settingsSaved"));
      setLang(language);
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 6) throw new Error(t("passwordTooShort"));
      if (newPassword !== confirmPassword) throw new Error(t("passwordsMismatch"));
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("passwordUpdated"));
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { canInstall, promptInstall, isInstalled } = usePwaInstall();

  if (profileQuery.isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
      </div>
    );
  }

  const SaveBtn = (
    <div>
      <Button
        onClick={() => saveAll.mutate()}
        disabled={saveAll.isPending}
        className="bg-primary hover:bg-primary/90"
      >
        {saveAll.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {tr("save")}
      </Button>
    </div>
  );


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader title={t("settings")} subtitle={t("settingsSubtitle")} />



      {/* পণ্য সমূহ */}
      <SectionCard title={tr("products")}>
        <Grid3>
          {/* Column 1 */}
          <ToggleRow label={tr("productActive")} checked={!!s.productActive} onChange={(v) => set("productActive", v)} />
          <SelectRow
            label={tr("itemType")}
            value={s.itemType ?? "product"}
            onChange={(v) => set("itemType", v as "product" | "service")}
            options={[
              { value: "product", label: tr("product") },
              { value: "service", label: tr("service") },
            ]}
          />
          <ToggleRow label={tr("sku")} checked={s.sku !== false} onChange={(v) => set("sku", v)} />
          <ToggleRow label={tr("barcodeScan")} checked={s.barcodeScan !== false} onChange={(v) => set("barcodeScan", v)} />
          <ToggleRow label={tr("stockMaintenance")} checked={!!s.stockMaintenance} onChange={(v) => set("stockMaintenance", v)} />
          <SelectRow
            label={tr("stockValuationMethod")}
            value={s.stockValuationMethod ?? "avg"}
            onChange={(v) => set("stockValuationMethod", v as "avg" | "fifo" | "lifo")}
            options={[
              { value: "avg", label: tr("avgPurchase") },
              { value: "fifo", label: tr("fifo") },
              { value: "lifo", label: tr("lifo") },
            ]}
          />
          <ToggleRow label={tr("itemUnit")} checked={!!s.itemUnit} onChange={(v) => set("itemUnit", v)} />
          <ToggleRow label={tr("itemCategory")} checked={!!s.itemCategory} onChange={(v) => set("itemCategory", v)} />
          <ToggleRow label={tr("showPurchasePrice")} checked={!!s.showPurchasePrice} onChange={(v) => set("showPurchasePrice", v)} />
          <ToggleRow label={tr("discount")} checked={!!s.discount} onChange={(v) => set("discount", v)} />

          {/* Column 2 */}
          <ToggleRow label={tr("vat")} checked={!!s.vat} onChange={(v) => set("vat", v)} />
          <ToggleRow label={tr("manufactureDate")} checked={!!s.manufactureDate} onChange={(v) => set("manufactureDate", v)} />
          <ToggleRow label={tr("expiryDate")} checked={!!s.expiryDate} onChange={(v) => set("expiryDate", v)} />
          <ToggleRow label={tr("description")} checked={!!s.description} onChange={(v) => set("description", v)} />
          <ToggleRow label={tr("showSalePrice")} checked={!!s.showSalePrice} onChange={(v) => set("showSalePrice", v)} />
          <ToggleRow label={tr("wholesale")} checked={!!s.wholesale} onChange={(v) => set("wholesale", v)} />
          <ToggleRow label={tr("mrpPrice")} checked={!!s.mrpPrice} onChange={(v) => set("mrpPrice", v)} />
          <ToggleRow label={tr("batchNumber")} checked={!!s.batchNumber} onChange={(v) => set("batchNumber", v)} />

          {/* Column 3 */}
          <ToggleRow label={tr("serialImei")} checked={!!s.serialImei} onChange={(v) => set("serialImei", v)} />
          <ToggleRow label={tr("size")} checked={!!s.size} onChange={(v) => set("size", v)} />
          <ToggleRow label={tr("warranty")} checked={!!s.warranty} onChange={(v) => set("warranty", v)} />
          <ToggleRow label={tr("expiryAlert")} checked={!!s.expiryAlert} onChange={(v) => set("expiryAlert", v)} />
          <NumberRow
            label={tr("expiryAlertDays")}
            value={s.expiryAlertDays}
            onChange={(v) => set("expiryAlertDays", v)}
          />
          <ToggleRow label={tr("lowStockAlert")} checked={!!s.lowStockAlert} onChange={(v) => set("lowStockAlert", v)} />
          <NumberRow
            label={tr("lowStockQty")}
            value={s.lowStockQty}
            onChange={(v) => set("lowStockQty", v)}
          />
        </Grid3>
        <div className="pt-2">{SaveBtn}</div>
      </SectionCard>

      {/* লেনদেন */}
      <SectionCard title={tr("transactions")}>
        <Grid3>
          <ToggleRow label={tr("showInvoiceNumber")} checked={!!s.showInvoiceNumber} onChange={(v) => set("showInvoiceNumber", v)} />
          <ToggleRow label={tr("cashSaleDefault")} checked={!!s.cashSaleDefault} onChange={(v) => set("cashSaleDefault", v)} />
          <ToggleRow label={tr("txShowPurchasePrice")} checked={!!s.txShowPurchasePrice} onChange={(v) => set("txShowPurchasePrice", v)} />
          <ToggleRow label={tr("txShowSalePrice")} checked={!!s.txShowSalePrice} onChange={(v) => set("txShowSalePrice", v)} />
          <ToggleRow label={tr("deliveryCharge")} checked={!!s.deliveryCharge} onChange={(v) => set("deliveryCharge", v)} />

          <ToggleRow label={tr("taxPerTx")} checked={!!s.taxPerTx} onChange={(v) => set("taxPerTx", v)} />
          <ToggleRow label={tr("discountPerTx")} checked={!!s.discountPerTx} onChange={(v) => set("discountPerTx", v)} />
          <ToggleRow label={tr("saleProfit")} checked={!!s.saleProfit} onChange={(v) => set("saleProfit", v)} />
          <ToggleRow label={tr("allowViewInvoice")} checked={!!s.allowViewInvoice} onChange={(v) => set("allowViewInvoice", v)} />
          <ToggleRow label={tr("discountOnPayment")} checked={!!s.discountOnPayment} onChange={(v) => set("discountOnPayment", v)} />
          <ToggleRow label={tr("dueSmsOnTx")} checked={!!s.dueSmsOnTx} onChange={(v) => set("dueSmsOnTx", v)} />

          <ToggleRow label={tr("inactiveSupplierOnSale")} checked={!!s.inactiveSupplierOnSale} onChange={(v) => set("inactiveSupplierOnSale", v)} />
          <ToggleRow label={tr("inactiveCustomerOnPurchase")} checked={!!s.inactiveCustomerOnPurchase} onChange={(v) => set("inactiveCustomerOnPurchase", v)} />
          <ToggleRow label={tr("autoIncrementInvoice")} checked={!!s.autoIncrementInvoice} onChange={(v) => set("autoIncrementInvoice", v)} />
          <NumberRow
            label={tr("startingInvoiceNumber")}
            value={s.startingInvoiceNumber}
            onChange={(v) => set("startingInvoiceNumber", v)}
          />
        </Grid3>
        <div className="pt-2">{SaveBtn}</div>
      </SectionCard>

      {/* এক্সপোর্ট ও প্রিন্টিং */}
      <SectionCard title={tr("exportPrint")}>
        <Grid2>
          <ToggleRow label={tr("showHeading")} checked={!!s.showHeading} onChange={(v) => set("showHeading", v)} />
          <ToggleRow label={tr("showInvoiceTerms")} checked={!!s.showInvoiceTerms} onChange={(v) => set("showInvoiceTerms", v)} />
          <ToggleRow label={tr("showCompanyName")} checked={!!s.showCompanyName} onChange={(v) => set("showCompanyName", v)} />
          <ToggleRow label={tr("showInvoiceDescription")} checked={!!s.showInvoiceDescription} onChange={(v) => set("showInvoiceDescription", v)} />
          <ToggleRow label={tr("showCompanyLogo")} checked={!!s.showCompanyLogo} onChange={(v) => set("showCompanyLogo", v)} />
          <Row label={tr("changeInvoiceDesign")}>
            <Button asChild size="sm" className="h-8 gap-1">
              <Link to="/invoice-design">
                {tr("go")} <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </Row>
          <ToggleRow label={tr("showExportDate")} checked={!!s.showExportDate} onChange={(v) => set("showExportDate", v)} />
          <ToggleRow label={tr("useRegularPrinter")} checked={!!s.useRegularPrinter} onChange={(v) => set("useRegularPrinter", v)} />
          <ToggleRow label={tr("showBusinessInfo")} checked={!!s.showBusinessInfo} onChange={(v) => set("showBusinessInfo", v)} />
          <ToggleRow label={tr("useThermalPrinter")} checked={!!s.useThermalPrinter} onChange={(v) => set("useThermalPrinter", v)} />
          <ToggleRow label={tr("showPreviousDue")} checked={!!s.showPreviousDue} onChange={(v) => set("showPreviousDue", v)} />
          <div />
          <ToggleRow label={tr("showFooter")} checked={!!s.showFooter} onChange={(v) => set("showFooter", v)} />
          <div />
          <ToggleRow label={tr("showSignature")} checked={!!s.showSignature} onChange={(v) => set("showSignature", v)} />
        </Grid2>
        <div className="pt-2">{SaveBtn}</div>
      </SectionCard>

      {/* Preferences + password kept as small footer */}
      <SectionCard title={tr("preferences")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>{tr("language")}</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "bn")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bn">বাংলা</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>{tr("currency")}</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="pt-2">{SaveBtn}</div>
      </SectionCard>

      <Card>
        <CardHeader>
          <CardTitle>{tr("changePassword")}</CardTitle>
          <CardDescription>{t("changePasswordDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{tr("newPassword")}</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-2">
              <Label>{tr("confirmPassword")}</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div>
            <Button
              variant="secondary"
              onClick={() => changePassword.mutate()}
              disabled={changePassword.isPending || !newPassword}
            >
              {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {tr("updatePassword")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Android APK builder card ---------- */

function AndroidBuildCard() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success("কমান্ড কপি হয়েছে");
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      toast.error("কপি করা যায়নি");
    }
  };

  const downloadScript = async () => {
    try {
      const res = await fetch("/build-android.sh");
      if (!res.ok) throw new Error("Script পাওয়া যায়নি");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/x-shellscript" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "build-android.sh";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Script ডাউনলোড হয়েছে");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const commands: { key: string; label: string; cmd: string }[] = [
    { key: "debug", label: "Debug APK (টেস্টিং)", cmd: "./scripts/build-android.sh" },
    { key: "release", label: "Release APK", cmd: "./scripts/build-android.sh release" },
    { key: "bundle", label: "Play Store AAB", cmd: "./scripts/build-android.sh bundle" },
  ];

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="bg-primary/5 border-b py-3">
        <CardTitle className="text-primary text-base font-semibold flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Android APK তৈরি করুন (One-Click)
        </CardTitle>
        <CardDescription className="text-xs">
          আপনার computer-এ project clone করার পর নিচের কমান্ড দিয়ে production-quality APK / Play Store AAB তৈরি করুন।
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* রেডি অ্যাপ ডাউনলোড সেকশন */}
        <ReadyAppDownloadCard />


        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold text-foreground mb-2">নিজের computer-এ বিল্ড করুন (Advanced)</h4>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>প্রথমবার প্রয়োজন:</strong> Node.js 20+, Java JDK 17, Android Studio (SDK 34+). বিস্তারিত guide:{" "}
            <code className="bg-amber-100 px-1 rounded">ANDROID_BUILD.md</code>
          </div>
        </div>


        <div className="space-y-2">
          {commands.map((c) => (
            <div
              key={c.key}
              className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
                <code className="block text-xs sm:text-sm font-mono text-foreground truncate">{c.cmd}</code>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0"
                onClick={() => copy(c.cmd, c.key)}
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                {copiedKey === c.key ? "কপি হয়েছে" : "কপি"}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={downloadScript} size="sm" className="bg-primary hover:bg-primary/90">
            <Download className="h-4 w-4 mr-2" />
            build-android.sh ডাউনলোড
          </Button>
          <Button asChild size="sm" variant="outline">
            <a
              href="https://developer.android.com/studio"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileCode className="h-4 w-4 mr-2" />
              Android Studio
            </a>
          </Button>
        </div>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">প্রথমবার সম্পূর্ণ Setup steps</summary>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>উপরের GitHub button দিয়ে project export করে clone করুন।</li>
            <li><code>chmod +x scripts/build-android.sh</code></li>
            <li><code>./scripts/build-android.sh</code> চালান।</li>
            <li>আউটপুট পাবেন <code>android-output/</code> folder-এ।</li>
            <li>Release বিল্ডের জন্য <code>capacitor.config.ts</code> এর <code>server</code> block কমেন্ট-আউট করুন।</li>
          </ol>
        </details>
      </CardContent>
    </Card>
  );
}

/* ---------- Layout helpers ---------- */

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="bg-primary/5 border-b py-3">
        <CardTitle className="text-primary text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-4">{children}</CardContent>
    </Card>
  );
}

function Grid3({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-8 gap-y-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Grid2({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-8 gap-y-3 grid-cols-1 md:grid-cols-2">{children}</div>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-9">
      <div className="flex items-center gap-1 text-sm text-foreground/80 text-right flex-1 justify-end">
        <span>{label}</span>
        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>
      <div className="shrink-0 min-w-[88px] flex justify-start">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <Switch checked={checked} onCheckedChange={onChange} />
        <span
          className={`text-[10px] font-semibold tracking-wide ${
            checked ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {checked ? "YES" : "NO"}
        </span>
      </div>
    </Row>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Row label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Row>
  );
}

function NumberRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <Row label={label}>
      <Input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="h-8 w-[88px]"
      />
    </Row>
  );
}

// ===== রেডি Android App ডাউনলোড কার্ড =====
function ReadyAppDownloadCard() {
  const envRepo = (import.meta.env.VITE_GITHUB_REPO as string | undefined)?.trim();
  const repo = envRepo && envRepo.includes("/") ? envRepo : "razusinfo/hisabnikas-24";
  const isConfigured = Boolean(envRepo && envRepo.includes("/"));
  const releasesUrl = `https://github.com/${repo}/releases/latest`;
  const directApkUrl = `https://github.com/${repo}/releases/latest/download/HisabNikash24-debug.apk`;
  const actionsUrl = `https://github.com/${repo}/actions/workflows/android-build.yml`;
  const [downloading, setDownloading] = useState(false);

  const fmtSize = (b: number) =>
    b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  const liveQuery = useQuery({
    queryKey: ["github-releases", repo],
    enabled: isConfigured,
    staleTime: 60_000,
    queryFn: async () => {
      const mod = await import("@/lib/github-releases.functions");
      return mod.getGithubReleases({ data: { repo } });
    },
  });

  return (
    <div className="rounded-lg border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
          <Download className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-emerald-900">রেডি Android App ডাউনলোড</h4>
          <p className="text-xs text-emerald-800/80 mt-0.5">
            সরাসরি ফোনে ইন্সটল করার জন্য APK ডাউনলোড করুন। কোনো setup লাগবে না।
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700"
          disabled={downloading}
          onClick={async () => {
            setDownloading(true);
            try {
              const res = await fetch(
                `https://api.github.com/repos/${repo}/releases/latest`,
                { headers: { Accept: "application/vnd.github+json" } },
              );
              if (res.status === 404) {
                toast.error("কোনো রিলিজ এখনো প্রকাশিত হয়নি");
                return;
              }
              if (!res.ok) {
                toast.error(`GitHub API error: ${res.status}`);
                return;
              }
              const rel = (await res.json()) as {
                tag_name: string;
                name: string | null;
                assets: Array<{ name: string; browser_download_url: string }>;
              };
              const assets = rel.assets || [];
              // Prefer release APK (non-debug, non-unsigned); fall back to any release APK; never debug.
              const releaseApk =
                assets.find(
                  (a) =>
                    /\.apk$/i.test(a.name) &&
                    !/debug/i.test(a.name) &&
                    !/unsigned/i.test(a.name),
                ) ||
                assets.find((a) => /release.*\.apk$/i.test(a.name)) ||
                assets.find((a) => /\.apk$/i.test(a.name) && !/debug/i.test(a.name));
              if (!releaseApk) {
                toast.error(
                  "এই রিলিজে কোনো release APK ফাইল পাওয়া যায়নি। অনুগ্রহ করে 'সব ভার্সন' থেকে দেখুন।",
                );
                return;
              }
              toast.success(`${rel.name || rel.tag_name} — ডাউনলোড শুরু হচ্ছে`);
              window.open(releaseApk.browser_download_url, "_blank", "noopener,noreferrer");
            } catch (e) {
              toast.error(
                `ডাউনলোড করা যাচ্ছে না: ${e instanceof Error ? e.message : "অজানা সমস্যা"}`,
              );
            } finally {
              setDownloading(false);
            }
          }}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          সর্বশেষ APK ডাউনলোড
        </Button>
        <Button asChild size="sm" variant="outline" className="border-emerald-300">
          <a
            href={`https://hisabnikas24.top/download/?current=${encodeURIComponent(APP_VERSION)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            ডাউনলোড পেজ
          </a>
        </Button>
        <Button asChild size="sm" variant="outline" className="border-emerald-300">
          <a href={releasesUrl} target="_blank" rel="noopener noreferrer">
            সব ভার্সন
          </a>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-emerald-300"
          onClick={async () => {
            const { fetchLatestRelease, openDownload, isNativeAndroid } = await import(
              "@/lib/app-update"
            );
            const latest = await fetchLatestRelease(repo);
            if (!latest) {
              toast.error("কোনো রিলিজ পাওয়া যায়নি");
              return;
            }
            if (!latest.apkUrl) {
              toast.error("APK পাওয়া যায়নি");
              return;
            }
            toast.success(
              isNativeAndroid()
                ? `নতুন ভার্সন: ${latest.name} — ডাউনলোড শুরু হচ্ছে`
                : `সর্বশেষ ভার্সন: ${latest.name}`,
            );
            openDownload(latest);
          }}
        >
          🔄 আপডেট চেক করুন
        </Button>
        {isConfigured && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => liveQuery.refetch()}
            disabled={liveQuery.isFetching}
          >
            {liveQuery.isFetching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            রিফ্রেশ
          </Button>
        )}
      </div>


      {/* Live API result */}
      {isConfigured && (
        <div className="rounded-md border border-emerald-200 bg-white/70 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold text-emerald-900">লাইভ ফাইল লিস্ট (GitHub API)</h5>
            {liveQuery.data?.hasToken === false && (
              <span className="text-[10px] text-amber-700">টোকেন ছাড়া — শুধু public repo</span>
            )}
          </div>

          {liveQuery.isLoading && (
            <div className="flex items-center gap-2 text-xs text-emerald-800">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> লোড হচ্ছে…
            </div>
          )}

          {liveQuery.data?.error && (
            <p className="text-xs text-rose-700">⚠️ {liveQuery.data.error}</p>
          )}

          {liveQuery.data?.release && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-emerald-800">
                <strong>রিলিজ:</strong> {liveQuery.data.release.name} ({liveQuery.data.release.tag})
                {liveQuery.data.release.prerelease && " · pre-release"}
              </p>
              {liveQuery.data.release.assets.length === 0 ? (
                <p className="text-[11px] text-emerald-700/70">কোনো asset পাওয়া যায়নি।</p>
              ) : (
                <ul className="space-y-1">
                  {liveQuery.data.release.assets.map((a) => (
                    <li key={a.name} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-emerald-900">📦 {a.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-emerald-700/70">{fmtSize(a.size)}</span>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px] border-emerald-300"
                        >
                          <a href={a.download_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3 w-3 mr-1" />
                            ডাউনলোড
                          </a>
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {liveQuery.data && !liveQuery.data.release && !liveQuery.data.error && (
            <p className="text-[11px] text-emerald-700/70">
              এখনো কোনো রিলিজ নেই। <code className="bg-emerald-100 px-1 rounded">git tag v1.0.0 && git push --tags</code> দিন।
            </p>
          )}

          {liveQuery.data && liveQuery.data.artifacts.length > 0 && (
            <div className="pt-2 border-t border-emerald-200/60">
              <p className="text-[11px] font-semibold text-emerald-900 mb-1">সাম্প্রতিক Artifacts</p>
              <ul className="space-y-0.5">
                {liveQuery.data.artifacts.slice(0, 5).map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-emerald-800">
                      {a.expired ? "⏳" : "🗂️"} {a.name}{" "}
                      <span className="text-emerald-700/60">({fmtSize(a.size)})</span>
                    </span>
                    <a
                      href={a.workflow_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:underline shrink-0"
                    >
                      run →
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-emerald-700/60 mt-1">
                * Artifacts শুধু GitHub-এ লগ-ইন থাকলে ডাউনলোড হবে (৯০ দিন রিটেনশন)।
              </p>
            </div>
          )}
        </div>
      )}

      {/* ৩ ধাপের গাইডলাইন */}
      <ol className="space-y-1.5 text-xs text-emerald-900 bg-white/60 rounded-md p-3 border border-emerald-200">
        <li className="flex gap-2">
          <span className="font-bold text-emerald-700 shrink-0">১.</span>
          <span>উপরের GitHub button দিয়ে প্রজেক্ট export করুন।</span>
        </li>
        <li className="flex gap-2">
          <span className="font-bold text-emerald-700 shrink-0">২.</span>
          <span>Actions tab-এ যান → workflow auto-run হবে (১০–১৫ মিনিট সময় লাগবে)।</span>
        </li>
        <li className="flex gap-2">
          <span className="font-bold text-emerald-700 shrink-0">৩.</span>
          <span>Releases থেকে APK ডাউনলোড করে ফোনে ইন্সটল করুন। ✓</span>
        </li>
      </ol>

      <p className="text-[11px] text-emerald-800/70 leading-relaxed">
        <strong>পাবলিক রিলিজ:</strong>{" "}
        <code className="bg-emerald-200/60 px-1 rounded">git tag v1.0.0 && git push --tags</code>{" "}
        — APK/AAB স্বয়ংক্রিয়ভাবে GitHub Release-এ attach হবে।
      </p>

      {!isConfigured && (
        <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded p-2 leading-relaxed">
          <strong>সেটআপ:</strong> GitHub-এ export করার পর{" "}
          <code className="bg-amber-100 px-1 rounded">.env</code>-এ{" "}
          <code className="bg-amber-100 px-1 rounded">VITE_GITHUB_REPO=owner/repo</code> যোগ করুন —
          তাহলে লাইভ ফাইল লিস্ট ও ডাউনলোড লিংক স্বয়ংক্রিয়ভাবে দেখাবে।
        </div>
      )}
    </div>
  );
}


