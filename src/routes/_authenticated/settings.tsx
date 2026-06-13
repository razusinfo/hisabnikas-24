import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Hash, Percent, FileText, CreditCard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type InvoiceSettings = {
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
  full_name: string | null;
  company_name: string | null;
  language: string;
  currency: string;
  logo_url: string | null;
  invoice_settings: InvoiceSettings | null;
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

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", "me"],
    queryFn: async (): Promise<Profile> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, company_name, language, currency, logo_url, invoice_settings")
        .eq("id", u.user.id)
        .single();
      if (error) throw error;
      return data as unknown as Profile;
    },
  });

  const emailQuery = useQuery({
    queryKey: ["auth", "email"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.email ?? "";
    },
  });

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [currency, setCurrency] = useState("BDT");
  const [language, setLanguage] = useState<"en" | "bn">("en");
  const [invoice, setInvoice] = useState<InvoiceSettings>({});

  const setInv = <K extends keyof InvoiceSettings>(k: K, v: InvoiceSettings[K]) =>
    setInvoice((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (profileQuery.data) {
      setFullName(profileQuery.data.full_name ?? "");
      setCompanyName(profileQuery.data.company_name ?? "");
      setCurrency(profileQuery.data.currency ?? "BDT");
      setLanguage((profileQuery.data.language as "en" | "bn") ?? "en");
      setInvoice(profileQuery.data.invoice_settings ?? {});
    }
  }, [profileQuery.data]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!profileQuery.data) throw new Error("No profile");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          company_name: companyName.trim() || null,
          currency,
          language,
          invoice_settings: invoice as never,
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

  const logoUrlQuery = useQuery({
    queryKey: ["logo-signed", profileQuery.data?.logo_url],
    enabled: !!profileQuery.data?.logo_url,
    queryFn: async () => {
      const path = profileQuery.data!.logo_url!;
      const { data, error } = await supabase.storage
        .from("business-logos")
        .createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      if (!profileQuery.data) throw new Error("No profile");
      const ext = file.name.split(".").pop() || "png";
      const path = `${profileQuery.data.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("business-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      if (profileQuery.data.logo_url) {
        await supabase.storage.from("business-logos").remove([profileQuery.data.logo_url]);
      }
      const { error } = await supabase
        .from("profiles")
        .update({ logo_url: path })
        .eq("id", profileQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("settingsSaved"));
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeLogo = useMutation({
    mutationFn: async () => {
      if (!profileQuery.data?.logo_url) return;
      await supabase.storage.from("business-logos").remove([profileQuery.data.logo_url]);
      const { error } = await supabase
        .from("profiles")
        .update({ logo_url: null })
        .eq("id", profileQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
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

  if (profileQuery.isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl space-y-6">
        <PageHeader title={t("settings")} subtitle={t("settingsSubtitle")} />

        <Card>
          <CardHeader>
            <CardTitle>{t("profileInfo")}</CardTitle>
            <CardDescription>{t("profileInfoDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>{t("email")}</Label>
              <Input value={emailQuery.data ?? ""} disabled />
            </div>
            <div className="grid gap-2">
              <Label>{t("fullName")}</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>{t("companyName")}</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>{t("businessLogo")}</Label>
              <div className="flex items-center gap-4">
                {logoUrlQuery.data ? (
                  <img
                    src={logoUrlQuery.data}
                    alt="logo"
                    className="h-16 w-16 rounded-md object-cover border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground">
                    —
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  className="max-w-xs"
                  disabled={uploadLogo.isPending}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadLogo.mutate(f);
                    e.target.value = "";
                  }}
                />
                {profileQuery.data?.logo_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLogo.mutate()}
                    disabled={removeLogo.isPending}
                  >
                    {t("removeLogo")}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("preferences")}</CardTitle>
            <CardDescription>{t("preferencesDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>{t("language")}</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "bn")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bn">বাংলা</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("currency")}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("invoiceSettings")}</CardTitle>
            <CardDescription>{t("invoiceSettingsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Hash className="h-4 w-4 text-muted-foreground" /> {t("invoiceNumbering")}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t("invoicePrefix")}</Label>
                  <Input
                    value={invoice.prefix ?? ""}
                    onChange={(e) => setInv("prefix", e.target.value)}
                    placeholder="INV-"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("invoiceNextNumber")}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={invoice.nextNumber ?? ""}
                    onChange={(e) => setInv("nextNumber", e.target.value === "" ? undefined : Number(e.target.value))}
                    placeholder="1001"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Percent className="h-4 w-4 text-muted-foreground" /> {t("invoiceTaxCharges")}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t("invoiceDefaultTax")}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={invoice.defaultTax ?? ""}
                    onChange={(e) => setInv("defaultTax", e.target.value === "" ? undefined : Number(e.target.value))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("invoiceDefaultDiscount")}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={invoice.defaultDiscount ?? ""}
                    onChange={(e) => setInv("defaultDiscount", e.target.value === "" ? undefined : Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="h-4 w-4 text-muted-foreground" /> {t("invoiceAppearance")}
              </div>
              <div className="grid gap-2">
                <Label>{t("invoiceFooter")}</Label>
                <Input
                  value={invoice.footer ?? ""}
                  onChange={(e) => setInv("footer", e.target.value)}
                  placeholder="Thank you for your business!"
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("invoiceTerms")}</Label>
                <Textarea
                  rows={3}
                  value={invoice.terms ?? ""}
                  onChange={(e) => setInv("terms", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("invoiceNotes")}</Label>
                <Textarea
                  rows={2}
                  value={invoice.notes ?? ""}
                  onChange={(e) => setInv("notes", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CreditCard className="h-4 w-4 text-muted-foreground" /> {t("invoicePayment")}
              </div>
              <div className="grid gap-2">
                <Label>{t("invoiceBankDetails")}</Label>
                <Textarea
                  rows={3}
                  value={invoice.bankDetails ?? ""}
                  onChange={(e) => setInv("bankDetails", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("invoicePaymentInstructions")}</Label>
                <Textarea
                  rows={2}
                  value={invoice.paymentInstructions ?? ""}
                  onChange={(e) => setInv("paymentInstructions", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>



        <div className="flex justify-end">
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            {saveProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t("save")}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("changePassword")}</CardTitle>
            <CardDescription>{t("changePasswordDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>{t("newPassword")}</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("confirmPassword")}</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() => changePassword.mutate()}
                disabled={changePassword.isPending || !newPassword}
              >
                {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {t("updatePassword")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
}
