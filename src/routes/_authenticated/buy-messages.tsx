import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { fmtDateTime } from "@/lib/format";
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
  Loader2,
  MessageSquare,
  Smartphone,
  Copy,
  ChevronRight,
  Mail,
  Send,
  CreditCard,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { PaymentSuccessDialog } from "@/components/PaymentSuccessDialog";

export const Route = createFileRoute("/_authenticated/buy-messages")({
  component: BuyMessagesPage,
});

const BKASH_NUMBER = "01719220690";

type MsgPack = {
  id: string;
  name: string;
  count: number;
  price: number;
};

const PACKS: MsgPack[] = [
  { id: "msg_30", name: "৩০ মেসেজ", count: 30, price: 20 },
  { id: "msg_50", name: "৫০ মেসেজ", count: 50, price: 31 },
  { id: "msg_100", name: "১০০ মেসেজ", count: 100, price: 55 },
  { id: "msg_250", name: "২৫০ মেসেজ", count: 250, price: 125 },
  { id: "msg_500", name: "৫০০ মেসেজ", count: 500, price: 225 },
  { id: "msg_1000", name: "১০০০ মেসেজ", count: 1000, price: 400 },
];

const bn = (n: number) => Number(n).toLocaleString("bn-BD");

function BuyMessagesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<MsgPack | null>(null);
  const [senderNumber, setSenderNumber] = useState("");
  const [trxId, setTrxId] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);

  const profile = useQuery({
    queryKey: ["my-profile-credits"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("message_credits")
        .eq("id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const myRequests = useQuery({
    queryKey: ["my-message-requests"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await (supabase as any)
        .from("payment_requests")
        .select("*")
        .eq("user_id", u.user.id)
        .eq("kind", "messages")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("কোনো প্যাকেজ নির্বাচিত হয়নি");
      if (!/^01[0-9]{9}$/.test(senderNumber))
        throw new Error("সঠিক ১১ ডিজিটের বিকাশ নম্বর দিন");
      if (trxId.trim().length < 6) throw new Error("সঠিক TrxID দিন");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("লগইন প্রয়োজন");
      const { error } = await (supabase as any).from("payment_requests").insert({
        user_id: u.user.id,
        kind: "messages",
        plan: selected.id,
        messages_count: selected.count,
        amount: selected.price,
        bkash_number: BKASH_NUMBER,
        sender_number: senderNumber.trim(),
        trx_id: trxId.trim().toUpperCase(),
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        "পেমেন্ট রিকোয়েস্ট জমা হয়েছে। যাচাইয়ের পর মেসেজ ক্রেডিট যোগ হবে।",
      );
      qc.invalidateQueries({ queryKey: ["my-message-requests"] });
      setSelected(null);
      setSenderNumber("");
      setTrxId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = Number((profile.data as any)?.message_credits ?? 0);
  const packApproved = (myRequests.data ?? [])
    .filter((r: any) => r.status === "approved")
    .reduce((s: number, r: any) => s + Number(r.messages_count ?? 0), 0);
  const packBalance = Math.min(packApproved, total);
  const subBalance = Math.max(0, total - packBalance);

  const stats = [
    { label: "সাবস্ক্রিপশন", value: subBalance, icon: CreditCard },
    { label: "মেসেজ প্যাক", value: packBalance, icon: Send },
    { label: "মোট মেসেজ", value: total, icon: Mail },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <PageHeader
        title={t("buyMessages")}
        subtitle="বিকাশের মাধ্যমে SMS ক্রেডিট কিনুন"
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card
              key={s.label}
              className="p-5 bg-primary text-primary-foreground border-0 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary-foreground/15 ring-1 ring-primary-foreground/20 flex items-center justify-center shrink-0">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1 text-right">
                  <div className="text-sm opacity-90">{s.label}</div>
                  <div className="text-3xl font-bold mt-1">
                    {profile.isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin inline" />
                    ) : (
                      bn(s.value)
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="font-display font-semibold text-lg mb-3">
        মেসেজ প্যাক নির্বাচন করুন
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PACKS.map((p) => {
          const perMsg = (p.price / p.count).toFixed(2);
          return (
            <Card
              key={p.id}
              className="overflow-hidden flex flex-col hover:shadow-md transition-shadow"
            >
              <div className="p-5 pb-4">
                <div className="font-display font-semibold text-lg">
                  {p.name}
                </div>
                <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm text-muted-foreground">
                    ৳ {perMsg} / এসএমএস
                  </div>
                  <div className="text-primary font-bold text-lg">
                    ৳ {p.price.toFixed(2)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(p)}
                className="mt-auto flex items-center justify-between px-5 py-3 bg-primary/10 hover:bg-primary/15 text-primary font-medium text-sm transition-colors"
              >
                <span>কিনুন</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </Card>
          );
        })}
      </div>

      {(myRequests.data?.length ?? 0) > 0 && (
        <Card className="p-5 mt-6">
          <div className="font-semibold mb-3">আমার মেসেজ ক্রয় রিকোয়েস্ট</div>
          <div className="space-y-2">
            {myRequests.data!.map((r: any) => (
              <div
                key={r.id}
                className="flex items-center justify-between flex-wrap gap-2 text-sm border-b border-border/40 pb-2 last:border-0"
              >
                <div>
                  <div className="font-medium">
                    {bn(r.messages_count)} মেসেজ — ৳{bn(Number(r.amount))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    TrxID: {r.trx_id} · {fmtDateTime(r.created_at, "bn")}
                  </div>
                  {r.note && (
                    <div className="text-xs text-destructive mt-1">{r.note}</div>
                  )}
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

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>বিকাশে পেমেন্ট করুন</DialogTitle>
            <DialogDescription>
              {selected?.name} — ৳{selected?.price.toLocaleString("bn-BD")}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">
              পেমেন্ট নির্দেশনা
            </div>
            <ol className="text-sm space-y-1.5 list-decimal list-inside">
              <li>
                বিকাশ অ্যাপ/USSD থেকে{" "}
                <span className="font-mono font-bold">*247#</span> ডায়াল করুন
              </li>
              <li>"Send Money" সিলেক্ট করুন</li>
              <li>
                নম্বর:{" "}
                <span className="font-mono font-bold text-base">
                  {BKASH_NUMBER}
                </span>
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
                পরিমাণ:{" "}
                <span className="font-bold">
                  ৳{selected?.price.toLocaleString("bn-BD")}
                </span>
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
                onChange={(e) =>
                  setSenderNumber(e.target.value.replace(/\D/g, ""))
                }
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
            <Button
              onClick={() => submit.mutate()}
              disabled={submit.isPending}
            >
              {submit.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Smartphone className="h-4 w-4 mr-1" />
              )}
              জমা দিন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
