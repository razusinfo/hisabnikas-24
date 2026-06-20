import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import {
  Check,
  X,
  Sparkles,
  Loader2,
  Smartphone,
  Copy,
  Clock,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/current-package")({
  component: CurrentPackagePage,
});

const BKASH_NUMBER = "01719220690";

type Billing = "monthly" | "yearly";

type Tier = {
  key: "basic" | "premium" | "business";
  name: string;
  monthly: { id: string; price: number; days: number };
  yearly: { id: string; price: number; days: number };
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    key: "basic",
    name: "Basic",
    monthly: { id: "basic_30", price: 0, days: 30 },
    yearly: { id: "basic_365", price: 0, days: 365 },
  },
  {
    key: "premium",
    name: "Premium",
    highlight: true,
    monthly: { id: "premium_30", price: 149, days: 30 },
    yearly: { id: "premium_365", price: 1188, days: 365 },
  },
  {
    key: "business",
    name: "Business",
    monthly: { id: "business_30", price: 249, days: 30 },
    yearly: { id: "business_365", price: 2988, days: 365 },
  },
];

type Cell =
  | { kind: "check" }
  | { kind: "cross" }
  | { kind: "text"; text: string; sub?: string; muted?: boolean };

const CHECK: Cell = { kind: "check" };
const CROSS: Cell = { kind: "cross" };
const TXT = (text: string, sub?: string): Cell => ({ kind: "text", text, sub });

type Feature = { label: string; basic: Cell; premium: Cell; business: Cell };

const FEATURES: Feature[] = [
  { label: "পণ্য ও পার্টি সমূহ", basic: CHECK, premium: CHECK, business: CHECK },
  { label: "খরচ সমূহ", basic: CHECK, premium: CHECK, business: CHECK },
  { label: "লেনদেন সমূহ", basic: CHECK, premium: CHECK, business: CHECK },
  { label: "অফলাইন মোড", basic: CHECK, premium: CHECK, business: CHECK },
  { label: "একাধিক ডিভাইস", basic: CHECK, premium: CHECK, business: CHECK },
  { label: "এসএমএস", basic: TXT("১০"), premium: TXT("৫০"), business: TXT("১০০") },
  { label: "রিপোর্টস", basic: TXT("সীমিত", "(১ মাস)"), premium: CHECK, business: CHECK },
  { label: "ইনভয়েস প্রিন্ট", basic: TXT("সীমিত", "(জলছাপ সহ)"), premium: CHECK, business: CHECK },
  { label: "ইনভেন্টরি ব্যবস্থা", basic: TXT("সীমিত*", "(১ মাস)"), premium: CHECK, business: CHECK },
  { label: "ডেলিভারি চার্জ", basic: TXT("সীমিত*", "(১ মাস)"), premium: CHECK, business: CHECK },
  { label: "ব্যাংক লেনদেন", basic: TXT("সীমিত*", "(১ মাস)"), premium: CROSS, business: CHECK },
  { label: "থার্মাল প্রিন্টিং", basic: CROSS, premium: CHECK, business: CHECK },
  { label: "একাধিক ইউজার", basic: CROSS, premium: CROSS, business: TXT("✓ (৫ জন)") },
  { label: "একাধিক ব্যবসা", basic: CROSS, premium: CROSS, business: CHECK },
];

function CellView({ cell, accent }: { cell: Cell; accent: boolean }) {
  if (cell.kind === "check") {
    return (
      <div className={`mx-auto h-7 w-7 rounded-full flex items-center justify-center ${accent ? "bg-primary/15" : "bg-muted"}`}>
        <Check className="h-4 w-4 text-primary" />
      </div>
    );
  }
  if (cell.kind === "cross") {
    return (
      <div className="mx-auto h-7 w-7 rounded-full ring-1 ring-destructive/40 flex items-center justify-center">
        <X className="h-4 w-4 text-destructive" />
      </div>
    );
  }
  return (
    <div className="text-center leading-tight">
      <div className="font-semibold text-primary text-sm">{cell.text}</div>
      {cell.sub && <div className="text-[11px] text-muted-foreground">{cell.sub}</div>}
    </div>
  );
}

function CurrentPackagePage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [billing, setBilling] = useState<Billing>("monthly");
  const [selected, setSelected] = useState<{ tier: Tier; price: number; id: string; days: number } | null>(null);
  const [senderNumber, setSenderNumber] = useState("");
  const [trxId, setTrxId] = useState("");

  const sub = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const myRequests = useQuery({
    queryKey: ["my-payment-requests"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await (supabase as any)
        .from("payment_requests")
        .select("*")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("কোনো প্যাকেজ নির্বাচিত হয়নি");
      if (!/^01[0-9]{9}$/.test(senderNumber)) throw new Error("সঠিক ১১ ডিজিটের নম্বর দিন");
      if (trxId.trim().length < 6) throw new Error("সঠিক TrxID দিন");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("লগইন প্রয়োজন");
      const { error } = await (supabase as any).from("payment_requests").insert({
        user_id: u.user.id,
        plan: selected.id,
        duration_days: selected.days,
        amount: selected.price,
        bkash_number: BKASH_NUMBER,
        sender_number: senderNumber.trim(),
        trx_id: trxId.trim(),
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("পেমেন্ট রিকোয়েস্ট জমা হয়েছে। যাচাইয়ের পর প্যাকেজ চালু হবে।");
      qc.invalidateQueries({ queryKey: ["my-payment-requests"] });
      setSelected(null);
      setSenderNumber("");
      setTrxId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentPlanId = sub.data?.plan ?? "trial";
  const expiresAt = sub.data?.expires_at ? new Date(sub.data.expires_at) : null;
  const daysLeft = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000))
    : null;
  const isTrial = currentPlanId === "trial";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <PageHeader title={t("currentPackage")} subtitle="বিকাশের মাধ্যমে প্যাকেজ ক্রয় করুন" />

      {sub.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card className="p-5 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center">
                  {isTrial ? <Clock className="h-5 w-5 text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">বর্তমান প্যাকেজ</div>
                  <div className="font-semibold">
                    {isTrial ? "ফ্রি ট্রায়াল (১০ দিন)" : currentPlanId}
                  </div>
                </div>
              </div>
              {expiresAt && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">মেয়াদ শেষ</div>
                  <div className="font-semibold text-sm">
                    {fmtDate(expiresAt, "bn")}{" "}
                    {daysLeft !== null && (
                      <span className={daysLeft <= 3 ? "text-destructive" : "text-muted-foreground"}>
                        ({daysLeft} দিন বাকি)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Pricing comparison */}
          <div className="text-center mb-4">
            <h2 className="font-display text-xl sm:text-2xl font-bold">
              আপনার পছন্দের প্যাকেজটি নির্বাচন করুন
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              বাৎসরিক প্যাকেজ <span className="text-primary font-semibold">১৭% অধিক সাশ্রয়ী</span>
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex justify-center mb-5">
            <div className="inline-flex rounded-full bg-muted p-1">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-6 py-2 text-sm font-semibold rounded-full transition ${
                  billing === "monthly" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
                }`}
              >
                মাসিক
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`px-6 py-2 text-sm font-semibold rounded-full transition ${
                  billing === "yearly" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
                }`}
              >
                বাৎসরিক
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-stretch pt-4">
            {TIERS.map((tier) => {
              const pricing = tier[billing];
              const isFree = pricing.price === 0;
              const isCurrent = currentPlanId === pricing.id || (tier.key === "basic" && isTrial);
              const isHighlight = !!tier.highlight;
              const tierKey = tier.key;
              const subtitle =
                tierKey === "basic"
                  ? "ক্ষুদ্র ব্যবসার জন্য উপযুক্ত"
                  : tierKey === "premium"
                    ? "মাঝারি ব্যবসার জন্য সেরা সমাধান"
                    : "বড় এন্টারপ্রাইজ লেভেল ব্যবসা";

              return (
                <div
                  key={tier.key}
                  className={`relative bg-card rounded-2xl p-7 flex flex-col transition-shadow ${
                    isHighlight
                      ? "border-2 border-primary shadow-xl md:-translate-y-4 shadow-primary/10"
                      : "border border-border shadow-sm hover:shadow-md"
                  }`}
                >
                  {isHighlight && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow">
                      জনপ্রিয়
                    </div>
                  )}

                  <h3 className="text-xl font-bold text-foreground mb-1">{tier.name}</h3>
                  <p className="text-muted-foreground text-sm mb-5">{subtitle}</p>

                  <div className="mb-6">
                    {isFree ? (
                      <span className="text-4xl font-bold text-foreground">Free</span>
                    ) : (
                      <>
                        <span className="text-4xl font-bold text-foreground">
                          ৳{pricing.price.toLocaleString("bn-BD")}
                        </span>
                        <span className="text-muted-foreground text-sm ml-1">
                          /{billing === "monthly" ? "মাসিক" : "বাৎসরিক"}
                        </span>
                      </>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 flex-grow">
                    {FEATURES.map((f) => {
                      const cell = f[tierKey];
                      const isCross = cell.kind === "cross";
                      return (
                        <li
                          key={f.label}
                          className={`flex items-start gap-3 text-sm ${
                            isCross ? "text-muted-foreground/60" : "text-foreground/85"
                          }`}
                        >
                          {isCross ? (
                            <X className="w-5 h-5 text-muted-foreground/50 shrink-0 mt-0.5" />
                          ) : (
                            <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                          )}
                          <span className="leading-snug">
                            {f.label}
                            {cell.kind === "text" && (
                              <span className="text-muted-foreground">
                                {" — "}
                                {cell.text}
                                {cell.sub ? ` ${cell.sub}` : ""}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {isCurrent && (
                    <Badge variant="secondary" className="self-start mb-3 text-[10px]">
                      বর্তমান
                    </Badge>
                  )}

                  {isFree || isCurrent ? (
                    <Button
                      variant={isHighlight ? "default" : "outline"}
                      disabled
                      className="w-full rounded-xl py-6 font-semibold"
                    >
                      {isCurrent ? "বর্তমান প্যাকেজ" : "Free"}
                    </Button>
                  ) : (
                    <Button
                      variant={isHighlight ? "default" : "outline"}
                      className={`w-full rounded-xl py-6 font-semibold ${
                        isHighlight ? "shadow-lg shadow-primary/20" : ""
                      }`}
                      onClick={() =>
                        setSelected({ tier, price: pricing.price, id: pricing.id, days: pricing.days })
                      }
                    >
                      {isHighlight ? "এখনই নিন" : "শুরু করুন"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {(myRequests.data?.length ?? 0) > 0 && (
            <Card className="p-5 mt-6">
              <div className="font-semibold mb-3">আমার পেমেন্ট রিকোয়েস্ট</div>
              <div className="space-y-2">
                {myRequests.data!.map((r: any) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between flex-wrap gap-2 text-sm border-b border-border/40 pb-2 last:border-0"
                  >
                    <div>
                      <div className="font-medium">
                        {r.plan} — ৳{Number(r.amount).toLocaleString("bn-BD")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        TrxID: {r.trx_id} · {fmtDateTime(r.created_at, "bn")}
                      </div>
                      {r.note && <div className="text-xs text-destructive mt-1">{r.note}</div>}
                    </div>
                    <Badge
                      variant={
                        r.status === "approved"
                          ? "default"
                          : r.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {r.status === "approved"
                        ? "অনুমোদিত"
                        : r.status === "rejected"
                          ? "বাতিল"
                          : "প্রক্রিয়াধীন"}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>বিকাশে পেমেন্ট করুন</DialogTitle>
            <DialogDescription>
              {selected?.tier.name} ({billing === "monthly" ? "মাসিক" : "বাৎসরিক"}) — ৳
              {selected?.price.toLocaleString("bn-BD")}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">পেমেন্ট নির্দেশনা</div>
            <ol className="text-sm space-y-1.5 list-decimal list-inside">
              <li>বিকাশ অ্যাপ/USSD থেকে <span className="font-mono font-bold">*247#</span> ডায়াল করুন</li>
              <li>"Send Money" সিলেক্ট করুন</li>
              <li>
                নম্বর:{" "}
                <span className="font-mono font-bold text-base">{BKASH_NUMBER}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 ml-1"
                  onClick={() => {
                    navigator.clipboard.writeText(BKASH_NUMBER);
                    toast.success("নম্বর কপি হয়েছে");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </li>
              <li>
                পরিমাণ: <span className="font-bold">৳{selected?.price.toLocaleString("bn-BD")}</span>
              </li>
              <li>পেমেন্ট সম্পন্ন হলে নিচের ফর্মে TrxID দিন</li>
            </ol>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="sender">আপনার বিকাশ নম্বর</Label>
              <Input
                id="sender"
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="01XXXXXXXXX"
                maxLength={11}
                inputMode="numeric"
              />
            </div>
            <div>
              <Label htmlFor="trx">Transaction ID (TrxID)</Label>
              <Input
                id="trx"
                value={trxId}
                onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                placeholder="যেমন: BK7XYZ12AB"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              বাতিল
            </Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              জমা দিন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
