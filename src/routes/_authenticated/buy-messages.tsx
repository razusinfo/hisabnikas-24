import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Loader2,
  MessageSquare,
  Smartphone,
  Copy,
  Zap,
  Send,
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Eye,
  FileText,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/buy-messages")({
  component: BuyMessagesPage,
});

type Template = {
  id: string;
  name: string;
  channel: "sms" | "whatsapp" | "both";
  body: string;
  created_at: string;
};

const VARIABLES: { key: string; label: string; sample: string }[] = [
  { key: "customer_name", label: "কাস্টমারের নাম", sample: "রহিম উদ্দিন" },
  { key: "shop_name", label: "দোকানের নাম", sample: "আমার দোকান" },
  { key: "amount", label: "পরিমাণ", sample: "১,২০০" },
  { key: "due", label: "বাকি", sample: "৫০০" },
  { key: "paid", label: "পরিশোধিত", sample: "৭০০" },
  { key: "invoice_no", label: "ইনভয়েস নং", sample: "INV-০০১" },
  { key: "date", label: "তারিখ", sample: new Date().toLocaleDateString("bn-BD") },
  { key: "phone", label: "ফোন", sample: "01XXXXXXXXX" },
];

const SAMPLE_TEMPLATES: { name: string; channel: "sms" | "whatsapp" | "both"; body: string }[] = [
  {
    name: "বাকি স্মরণ",
    channel: "sms",
    body: "প্রিয় {customer_name}, {shop_name} থেকে আপনার বকেয়া ৳{due}। অনুগ্রহ করে পরিশোধ করুন। ধন্যবাদ।",
  },
  {
    name: "পেমেন্ট রসিদ",
    channel: "whatsapp",
    body: "প্রিয় {customer_name}, {shop_name} এ আপনার ৳{paid} পরিশোধ গৃহীত হয়েছে। ইনভয়েস: {invoice_no}। বাকি: ৳{due}।",
  },
  {
    name: "নতুন অফার",
    channel: "both",
    body: "{shop_name} এ বিশেষ অফার! আজই আসুন। বিস্তারিত: {phone}",
  },
];

function renderPreview(body: string) {
  let out = body;
  for (const v of VARIABLES) {
    out = out.replaceAll(`{${v.key}}`, v.sample);
  }
  return out;
}

const BKASH_NUMBER = "01719220690";

type MsgPack = {
  id: string;
  name: string;
  count: number;
  price: number;
  icon: typeof MessageSquare;
  highlight?: boolean;
  features: string[];
};

const PACKS: MsgPack[] = [
  {
    id: "msg_100",
    name: "১০০ মেসেজ",
    count: 100,
    price: 50,
    icon: MessageSquare,
    features: ["১০০টি SMS ক্রেডিট", "মেয়াদ নেই", "তাৎক্ষণিক ব্যবহার"],
  },
  {
    id: "msg_500",
    name: "৫০০ মেসেজ",
    count: 500,
    price: 225,
    icon: Send,
    highlight: true,
    features: ["৫০০টি SMS ক্রেডিট", "১০% ছাড়", "মেয়াদ নেই"],
  },
  {
    id: "msg_1000",
    name: "১০০০ মেসেজ",
    count: 1000,
    price: 400,
    icon: Zap,
    features: ["১০০০টি SMS ক্রেডিট", "২০% ছাড়", "মেয়াদ নেই"],
  },
  {
    id: "msg_5000",
    name: "৫০০০ মেসেজ",
    count: 5000,
    price: 1750,
    icon: Megaphone,
    features: ["৫০০০টি SMS ক্রেডিট", "৩০% ছাড়", "বাল্ক ক্যাম্পেইনের জন্য"],
  },
];

function BuyMessagesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<MsgPack | null>(null);
  const [senderNumber, setSenderNumber] = useState("");
  const [trxId, setTrxId] = useState("");

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

  const credits = (profile.data as any)?.message_credits ?? 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <PageHeader
        title={t("buyMessages")}
        subtitle="বিকাশের মাধ্যমে SMS ক্রেডিট কিনুন"
      />

      <Card className="p-5 mb-6 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/20 ring-1 ring-primary/30 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">বর্তমান মেসেজ ব্যালেন্স</div>
              <div className="text-2xl font-bold">
                {profile.isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>{Number(credits).toLocaleString("bn-BD")} মেসেজ</>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PACKS.map((p) => {
          const Icon = p.icon;
          const perMsg = (p.price / p.count).toFixed(2);
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
                <span className="text-2xl font-bold">
                  ৳{p.price.toLocaleString("bn-BD")}
                </span>
                <span className="text-xs text-muted-foreground">
                  (৳{perMsg}/মেসেজ)
                </span>
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
                variant={p.highlight ? "default" : "secondary"}
                onClick={() => setSelected(p)}
              >
                <Smartphone className="h-4 w-4 mr-1.5" />
                বিকাশে কিনুন
              </Button>
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
                    {r.messages_count?.toLocaleString("bn-BD")} মেসেজ — ৳
                    {Number(r.amount).toLocaleString("bn-BD")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    TrxID: {r.trx_id} ·{" "}
                    {new Date(r.created_at).toLocaleString("bn-BD")}
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
              ) : null}
              জমা দিন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplateManager />
    </div>
  );
}

function TemplateManager() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Template | null>(null);
  const [open, setOpen] = useState(false);
  const [previewOf, setPreviewOf] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp" | "both">("sms");
  const [body, setBody] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const templates = useQuery({
    queryKey: ["message-templates"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as Template[];
      const { data, error } = await (supabase as any)
        .from("message_templates")
        .select("*")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const reset = () => {
    setEditing(null);
    setName("");
    setChannel("sms");
    setBody("");
  };

  const startNew = () => {
    reset();
    setOpen(true);
  };

  const startEdit = (t: Template) => {
    setEditing(t);
    setName(t.name);
    setChannel(t.channel);
    setBody(t.body);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("টেমপ্লেট নাম দিন");
      if (!body.trim()) throw new Error("বার্তা লিখুন");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("লগইন প্রয়োজন");
      if (editing) {
        const { error } = await (supabase as any)
          .from("message_templates")
          .update({ name: name.trim(), channel, body: body.trim() })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("message_templates")
          .insert({
            user_id: u.user.id,
            name: name.trim(),
            channel,
            body: body.trim(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "টেমপ্লেট আপডেট হয়েছে" : "টেমপ্লেট সেভ হয়েছে");
      qc.invalidateQueries({ queryKey: ["message-templates"] });
      setOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("message_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("টেমপ্লেট মুছে ফেলা হয়েছে");
      qc.invalidateQueries({ queryKey: ["message-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loadSample = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("লগইন প্রয়োজন");
      const rows = SAMPLE_TEMPLATES.map((s) => ({ ...s, user_id: u.user!.id }));
      const { error } = await (supabase as any)
        .from("message_templates")
        .insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("নমুনা টেমপ্লেট যোগ হয়েছে");
      qc.invalidateQueries({ queryKey: ["message-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const insertVariable = (key: string) => {
    const el = bodyRef.current;
    const token = `{${key}}`;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const channelLabel = (c: Template["channel"]) =>
    c === "sms" ? "SMS" : c === "whatsapp" ? "WhatsApp" : "SMS + WhatsApp";

  return (
    <Card className="p-5 mt-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-display font-semibold text-lg">
              মেসেজ টেমপ্লেট
            </div>
            <div className="text-xs text-muted-foreground">
              SMS/WhatsApp এর জন্য রিইউজযোগ্য টেমপ্লেট তৈরি করুন। ভেরিয়েবল ব্যবহার করুন যেমন {"{customer_name}"}, {"{amount}"}, {"{due}"}।
            </div>
          </div>
        </div>
        <Button size="sm" onClick={startNew}>
          <Plus className="h-4 w-4 mr-1" /> নতুন টেমপ্লেট
        </Button>
      </div>

      {templates.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (templates.data?.length ?? 0) === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
          <div className="text-sm text-muted-foreground mb-3">
            এখনো কোনো টেমপ্লেট নেই
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => loadSample.mutate()}
            disabled={loadSample.isPending}
          >
            {loadSample.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : null}
            নমুনা টেমপ্লেট লোড করুন
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.data!.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border bg-card p-3 flex flex-col"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="font-medium truncate">{t.name}</div>
                <Badge variant="secondary" className="shrink-0">
                  {channelLabel(t.channel)}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                {t.body}
              </div>
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPreviewOf(t)}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" /> প্রিভিউ
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(t.body);
                    toast.success("কপি হয়েছে");
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> কপি
                </Button>
                <Button size="sm" variant="ghost" onClick={() => startEdit(t)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> এডিট
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`"${t.name}" মুছে ফেলবেন?`)) remove.mutate(t.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "টেমপ্লেট এডিট করুন" : "নতুন টেমপ্লেট"}
            </DialogTitle>
            <DialogDescription>
              ভেরিয়েবল ক্লিক করে বার্তায় যোগ করুন
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tpl-name">নাম</Label>
                <Input
                  id="tpl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: বাকি স্মরণ"
                />
              </div>
              <div>
                <Label htmlFor="tpl-channel">চ্যানেল</Label>
                <Select
                  value={channel}
                  onValueChange={(v) => setChannel(v as Template["channel"])}
                >
                  <SelectTrigger id="tpl-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="both">SMS + WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>ভেরিয়েবল</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="text-xs px-2 py-1 rounded-md border bg-muted/40 hover:bg-muted transition-colors"
                    title={v.label}
                  >
                    <span className="font-mono">{`{${v.key}}`}</span>
                    <span className="text-muted-foreground ml-1">
                      · {v.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="tpl-body">বার্তা</Label>
              <Textarea
                id="tpl-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="প্রিয় {customer_name}, আপনার বকেয়া ৳{due}।"
              />
              <div className="text-xs text-muted-foreground mt-1">
                {body.length} অক্ষর
              </div>
            </div>

            {body.trim() && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  প্রিভিউ
                </div>
                <div className="text-sm whitespace-pre-wrap">
                  {renderPreview(body)}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              বাতিল
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              সেভ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewOf} onOpenChange={(o) => !o && setPreviewOf(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{previewOf?.name}</DialogTitle>
            <DialogDescription>
              {previewOf ? channelLabel(previewOf.channel) : ""} · নমুনা ডেটা দিয়ে প্রিভিউ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border p-3 bg-muted/40">
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                টেমপ্লেট
              </div>
              <div className="text-sm whitespace-pre-wrap font-mono">
                {previewOf?.body}
              </div>
            </div>
            <div className="rounded-lg border p-3 bg-primary/5">
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                প্রিভিউ
              </div>
              <div className="text-sm whitespace-pre-wrap">
                {previewOf ? renderPreview(previewOf.body) : ""}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (previewOf) {
                  navigator.clipboard.writeText(renderPreview(previewOf.body));
                  toast.success("প্রিভিউ কপি হয়েছে");
                }
              }}
            >
              <Copy className="h-4 w-4 mr-1" /> প্রিভিউ কপি
            </Button>
            <Button onClick={() => setPreviewOf(null)}>বন্ধ করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
