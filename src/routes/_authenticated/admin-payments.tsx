import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff, Ban, Search, Users, Mail, Phone, Building2, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-payments")({
  component: AdminPaymentsPage,
});

type Sub = {
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  plan: string;
  status: string;
  started_at: string | null;
  expires_at: string | null;
};

type UserRow = {
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string | null;
  plan: string | null;
  status: string | null;
  expires_at: string | null;
  message_credits: number;
  roles: string[];
};

function AdminPaymentsPage() {
  const qc = useQueryClient();
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});

  const meAdmin = useQuery({
    queryKey: ["is-super-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.rpc("is_super_admin", { _uid: u.user.id });
      return !!data;
    },
  });

  const list = useQuery({
    queryKey: ["all-payment-requests"],
    enabled: !!meAdmin.data,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("payment_requests")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const subsList = useQuery({
    queryKey: ["all-subscriptions"],
    enabled: !!meAdmin.data,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("list_all_subscriptions");
      if (error) throw error;
      return (data ?? []) as Sub[];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("approve_payment_request", { _request_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("অনুমোদিত — গ্রাহকের প্যাকেজ চালু হয়েছে");
      qc.invalidateQueries({ queryKey: ["all-payment-requests"] });
      qc.invalidateQueries({ queryKey: ["all-subscriptions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await (supabase as any).rpc("reject_payment_request", {
        _request_id: id,
        _note: note || "যাচাইয়ে ব্যর্থ",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("বাতিল করা হয়েছে");
      qc.invalidateQueries({ queryKey: ["all-payment-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async ({ user_id, _reason }: { user_id: string; _reason: string }) => {
      const { error } = await (supabase as any).rpc("revoke_subscription", {
        _user_id: user_id,
        _reason: _reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("গ্রাহকের প্যাকেজ বাতিল করা হয়েছে");
      qc.invalidateQueries({ queryKey: ["all-subscriptions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredSubs = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = subsList.data ?? [];
    if (!s) return rows;
    return rows.filter(
      (r) =>
        (r.full_name ?? "").toLowerCase().includes(s) ||
        (r.company_name ?? "").toLowerCase().includes(s) ||
        (r.phone ?? "").toLowerCase().includes(s) ||
        (r.plan ?? "").toLowerCase().includes(s),
    );
  }, [subsList.data, q]);

  if (meAdmin.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!meAdmin.data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
        <Card className="p-6 text-center">
          <ShieldOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <div className="font-semibold">প্রবেশাধিকার নেই</div>
          <p className="text-sm text-muted-foreground mt-1">
            এই পেইজ শুধুমাত্র সুপার অ্যাডমিনদের জন্য।
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <PageHeader
        title="পেমেন্ট অনুমোদন"
        subtitle="বিকাশ পেমেন্ট যাচাই করুন ও গ্রাহকের প্যাকেজ ব্যবস্থাপনা করুন"
      />

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="requests">পেমেন্ট রিকোয়েস্ট</TabsTrigger>
          <TabsTrigger value="subscriptions">প্যাকেজ ব্যবস্থাপনা</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          {list.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">কোনো রিকোয়েস্ট নেই</Card>
          ) : (
            <div className="space-y-3">
              {list.data!.map((r: any) => (
                <Card key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 text-sm">
                      <div className="font-semibold">
                        {r.kind === "messages"
                          ? <>{r.plan} · {Number(r.messages_count ?? 0).toLocaleString("bn-BD")} মেসেজ · ৳{Number(r.amount).toLocaleString("bn-BD")}</>
                          : <>{r.plan} · {r.duration_days} দিন · ৳{Number(r.amount).toLocaleString("bn-BD")}</>}
                      </div>
                      <div className="text-muted-foreground">
                        গ্রাহক বিকাশ: <span className="font-mono">{r.sender_number}</span>
                      </div>
                      <div className="text-muted-foreground">
                        TrxID: <span className="font-mono font-semibold text-foreground">{r.trx_id}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDateTime(r.created_at, "bn")}
                      </div>
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
                      {r.status}
                    </Badge>
                  </div>

                  {r.status === "pending" && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Input
                        placeholder="বাতিলের কারণ (ঐচ্ছিক)"
                        value={rejectNote[r.id] ?? ""}
                        onChange={(e) =>
                          setRejectNote((s) => ({ ...s, [r.id]: e.target.value }))
                        }
                        className="flex-1 min-w-[200px]"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reject.mutate({ id: r.id, note: rejectNote[r.id] ?? "" })}
                        disabled={reject.isPending}
                      >
                        বাতিল
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approve.mutate(r.id)}
                        disabled={approve.isPending}
                      >
                        <ShieldCheck className="h-4 w-4 mr-1" />
                        অনুমোদন
                      </Button>
                    </div>
                  )}
                  {r.note && r.status === "rejected" && (
                    <div className="mt-2 text-xs text-destructive">কারণ: {r.note}</div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="subscriptions">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="নাম, প্রতিষ্ঠান, ফোন বা প্ল্যান অনুসারে খুঁজুন"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>

          {subsList.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSubs.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              কোনো সাবস্ক্রিপশন পাওয়া যায়নি
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredSubs.map((r) => {
                const active = r.status === "active";
                return (
                  <Card key={r.user_id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 text-sm min-w-0">
                        <div className="font-semibold truncate">
                          {r.company_name || r.full_name || "—"}
                        </div>
                        <div className="text-muted-foreground">
                          {r.full_name && r.company_name ? r.full_name + " · " : ""}
                          <span className="font-mono">{r.phone ?? "—"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          প্ল্যান: <span className="text-foreground font-medium">{r.plan}</span>
                          {" · "}শুরু: {r.started_at ? fmtDateTime(r.started_at, "bn") : "—"}
                          {r.expires_at ? <> {" · "}মেয়াদ: {fmtDateTime(r.expires_at, "bn")}</> : null}
                        </div>
                      </div>
                      <Badge
                        variant={
                          r.status === "active"
                            ? "default"
                            : r.status === "revoked"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {r.status}
                      </Badge>
                    </div>

                    {active && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Input
                          placeholder="বাতিলের কারণ (ঐচ্ছিক)"
                          value={reason[r.user_id] ?? ""}
                          onChange={(e) =>
                            setReason((s) => ({ ...s, [r.user_id]: e.target.value }))
                          }
                          className="flex-1 min-w-[200px]"
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={revoke.isPending}>
                              <Ban className="h-4 w-4 mr-1" />
                              অনুমোদন বাতিল
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                              <AlertDialogDescription>
                                এই গ্রাহকের সক্রিয় প্যাকেজ এখনই বাতিল হয়ে যাবে। তিনি
                                আবার পেমেন্ট অনুমোদন না হওয়া পর্যন্ত পেইড ফিচার ব্যবহার
                                করতে পারবেন না।
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>না</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  revoke.mutate({
                                    user_id: r.user_id,
                                    _reason: reason[r.user_id] ?? "",
                                  })
                                }
                              >
                                হ্যাঁ, বাতিল করুন
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
