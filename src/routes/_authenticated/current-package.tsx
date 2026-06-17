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
  Sparkles,
  Loader2,
  Crown,
  Rocket,
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

type Plan = {
  id: string;
  name: string;
  price: number;
  days: number;
  icon: typeof Sparkles;
  highlight?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "basic_30",
    name: "Basic — ৩০ দিন",
    price: 399,
    days: 30,
    icon: Sparkles,
    features: ["সকল মৌলিক ফিচার", "আনলিমিটেড সেলস ও প্রোডাক্ট", "বেসিক রিপোর্ট"],
  },
  {
    id: "pro_30",
    name: "Pro — ৩০ দিন",
    price: 699,
    days: 30,
    icon: Rocket,
    highlight: true,
    features: [
      "Basic-এর সব ফিচার",
      "অ্যাডভান্সড রিপোর্ট",
      "অটো ব্যাকআপ",
      "প্রায়োরিটি সাপোর্ট",
    ],
  },
  {
    id: "basic_365",
    name: "Basic — ১ বছর",
    price: 1499,
    days: 365,
    icon: Crown,
    features: ["সকল মৌলিক ফিচার", "১ বছর মেয়াদ", "৬৮% সাশ্রয়ী"],
  },
  {
    id: "pro_365",
    name: "Pro — ১ বছর",
    price: 1999,
    days: 365,
    icon: Crown,
    highlight: true,
    features: [
      "Pro-এর সব ফিচার",
      "১ বছর মেয়াদ",
      "৭৬% সাশ্রয়ী",
      "অটো ব্যাকআপ",
    ],
  },
];

function CurrentPackagePage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Plan | null>(null);
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
                  {isTrial ? (
                    <Clock className="h-5 w-5 text-primary" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">বর্তমান প্যাকেজ</div>
                  <div className="font-semibold">
                    {isTrial ? "ফ্রি ট্রায়াল (১০ দিন)" : (PLANS.find((p) => p.id === currentPlanId)?.name ?? currentPlanId)}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((p) => {
              const Icon = p.icon;
              const isCurrent = currentPlanId === p.id;
              return (
                <Card
                  key={p.id}
                  className={`p-5 relative flex flex-col ${p.highlight ? "ring-2 ring-primary" : ""}`}
                >
                  {p.highlight && (
                    <Badge className="absolute -top-2 right-4">জনপ্রিয়</Badge>
                  )}
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="font-display font-semibold">{p.name}</div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-bold">৳{p.price.toLocaleString("bn-BD")}</span>
                  </div>
                  <ul className="mt-4 space-y-1.5 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-5 w-full"
                    variant={isCurrent ? "outline" : p.highlight ? "default" : "secondary"}
                    disabled={isCurrent}
                    onClick={() => setSelected(p)}
                  >
                    {isCurrent ? "বর্তমান প্যাকেজ" : (
                      <>
                        <Smartphone className="h-4 w-4 mr-1.5" />
                        বিকাশে কিনুন
                      </>
                    )}
                  </Button>
                </Card>
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
                        {PLANS.find((p) => p.id === r.plan)?.name ?? r.plan} — ৳{Number(r.amount).toLocaleString("bn-BD")}
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
              {selected?.name} — ৳{selected?.price.toLocaleString("bn-BD")}
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
