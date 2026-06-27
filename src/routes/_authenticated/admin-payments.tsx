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
import { useI18n } from "@/lib/i18n";
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

const statusLabel = (status: string | null | undefined, isBn: boolean) => {
  if (status === "approved") return isBn ? "অনুমোদিত" : "Approved";
  if (status === "rejected") return isBn ? "বাতিল" : "Rejected";
  if (status === "pending") return isBn ? "প্রক্রিয়াধীন" : "Pending";
  if (status === "active") return isBn ? "সক্রিয়" : "Active";
  if (status === "revoked") return isBn ? "বাতিল" : "Revoked";
  return status ?? "—";
};

const noteLabel = (note: string, isBn: boolean) => {
  if (isBn) return note;
  if (note === "যাচাইয়ে ব্যর্থ") return "Verification failed";
  if (note === "মেয়াদ উত্তীর্ণ") return "Expired";
  return note;
};

function AdminPaymentsPage() {
  const { lang } = useI18n();
  const isBn = lang === "bn";
  const qc = useQueryClient();
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [userQ, setUserQ] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const formatNumber = (n: number) => Number(n).toLocaleString(isBn ? "bn-BD" : "en-US");
  const formatDateTime = (value: string | null) => value ? fmtDateTime(value, lang) : "—";

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

  const usersList = useQuery({
    queryKey: ["all-users"],
    enabled: !!meAdmin.data,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("list_all_users");
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("approve_payment_request", { _request_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isBn ? "অনুমোদিত — গ্রাহকের প্যাকেজ চালু হয়েছে" : "Approved — customer package is now active");
      qc.invalidateQueries({ queryKey: ["all-payment-requests"] });
      qc.invalidateQueries({ queryKey: ["all-subscriptions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await (supabase as any).rpc("reject_payment_request", {
        _request_id: id,
        _note: note || (isBn ? "যাচাইয়ে ব্যর্থ" : "Verification failed"),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isBn ? "বাতিল করা হয়েছে" : "Rejected successfully");
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
      toast.success(isBn ? "গ্রাহকের প্যাকেজ বাতিল করা হয়েছে" : "Customer package has been revoked");
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

  const filteredUsers = useMemo(() => {
    const s = userQ.trim().toLowerCase();
    const rows = usersList.data ?? [];
    if (!s) return rows;
    return rows.filter(
      (r) =>
        (r.full_name ?? "").toLowerCase().includes(s) ||
        (r.company_name ?? "").toLowerCase().includes(s) ||
        (r.phone ?? "").toLowerCase().includes(s) ||
        (r.email ?? "").toLowerCase().includes(s),
    );
  }, [usersList.data, userQ]);

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
          <div className="font-semibold">{isBn ? "প্রবেশাধিকার নেই" : "Access denied"}</div>
          <p className="text-sm text-muted-foreground mt-1">
            {isBn ? "এই পেইজ শুধুমাত্র সুপার অ্যাডমিনদের জন্য।" : "This page is only for super admins."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <PageHeader
        title={isBn ? "পেমেন্ট অনুমোদন" : "Payment Approval"}
        subtitle={isBn ? "বিকাশ পেমেন্ট যাচাই করুন ও গ্রাহকের প্যাকেজ ব্যবস্থাপনা করুন" : "Verify bKash payments and manage customer packages"}
      />

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="requests">{isBn ? "পেমেন্ট রিকোয়েস্ট" : "Payment Requests"}</TabsTrigger>
          <TabsTrigger value="subscriptions">{isBn ? "প্যাকেজ ব্যবস্থাপনা" : "Package Management"}</TabsTrigger>
          <TabsTrigger value="users">{isBn ? "গ্রাহক সমূহ" : "Customers"}</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          {list.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">{isBn ? "কোনো রিকোয়েস্ট নেই" : "No requests found"}</Card>
          ) : (
            <div className="space-y-3">
              {list.data!.map((r: any) => (
                <Card key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 text-sm">
                      <div className="font-semibold">
                        {r.kind === "messages"
                          ? <>{r.plan} · {formatNumber(Number(r.messages_count ?? 0))} {isBn ? "মেসেজ" : "Messages"} · ৳{formatNumber(Number(r.amount))}</>
                          : <>{r.plan} · {formatNumber(Number(r.duration_days ?? 0))} {isBn ? "দিন" : "days"} · ৳{formatNumber(Number(r.amount))}</>}
                      </div>
                      <div className="text-muted-foreground">
                        {isBn ? "গ্রাহক বিকাশ" : "Customer bKash"}: <span className="font-mono">{r.sender_number}</span>
                      </div>
                      <div className="text-muted-foreground">
                        TrxID: <span className="font-mono font-semibold text-foreground">{r.trx_id}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(r.created_at)}
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
                      {statusLabel(r.status, isBn)}
                    </Badge>
                  </div>

                  {r.status === "pending" && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Input
                        placeholder={isBn ? "বাতিলের কারণ (ঐচ্ছিক)" : "Rejection reason (optional)"}
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
                        {isBn ? "বাতিল" : "Reject"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approve.mutate(r.id)}
                        disabled={approve.isPending}
                      >
                        <ShieldCheck className="h-4 w-4 mr-1" />
                        {isBn ? "অনুমোদন" : "Approve"}
                      </Button>
                    </div>
                  )}
                  {r.note && r.status === "rejected" && (
                    <div className="mt-2 text-xs text-destructive">{isBn ? "কারণ" : "Reason"}: {noteLabel(r.note, isBn)}</div>
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
              placeholder={isBn ? "নাম, প্রতিষ্ঠান, ফোন বা প্ল্যান অনুসারে খুঁজুন" : "Search by name, company, phone, or plan"}
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
              {isBn ? "কোনো সাবস্ক্রিপশন পাওয়া যায়নি" : "No subscriptions found"}
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
                          {isBn ? "প্ল্যান" : "Plan"}: <span className="text-foreground font-medium">{r.plan}</span>
                          {" · "}{isBn ? "শুরু" : "Start"}: {formatDateTime(r.started_at)}
                          {r.expires_at ? <> {" · "}{isBn ? "মেয়াদ" : "Expires"}: {formatDateTime(r.expires_at)}</> : null}
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
                        {statusLabel(r.status, isBn)}
                      </Badge>
                    </div>

                    {active && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Input
                          placeholder={isBn ? "বাতিলের কারণ (ঐচ্ছিক)" : "Revocation reason (optional)"}
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
                              {isBn ? "অনুমোদন বাতিল" : "Revoke"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{isBn ? "আপনি কি নিশ্চিত?" : "Are you sure?"}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {isBn
                                  ? "এই গ্রাহকের সক্রিয় প্যাকেজ এখনই বাতিল হয়ে যাবে। তিনি আবার পেমেন্ট অনুমোদন না হওয়া পর্যন্ত পেইড ফিচার ব্যবহার করতে পারবেন না।"
                                  : "This customer's active package will be revoked immediately. They cannot use paid features again until another payment is approved."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{isBn ? "না" : "No"}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  revoke.mutate({
                                    user_id: r.user_id,
                                    _reason: reason[r.user_id] ?? "",
                                  })
                                }
                              >
                                {isBn ? "হ্যাঁ, বাতিল করুন" : "Yes, revoke"}
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

        <TabsContent value="users">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isBn ? "নাম, প্রতিষ্ঠান, ফোন বা ইমেইল অনুসারে খুঁজুন" : "Search by name, company, phone, or email"}
              value={userQ}
              onChange={(e) => setUserQ(e.target.value)}
              className="pl-9"
            />
          </div>

          {usersList.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              {isBn ? "কোনো গ্রাহক পাওয়া যায়নি" : "No customers found"}
            </Card>
          ) : (
            <>
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {isBn ? "মোট" : "Total"} {formatNumber(filteredUsers.length)} {isBn ? "জন গ্রাহক" : "customers"}
              </div>
              <div className="space-y-3">
                {filteredUsers.map((u) => {
                  const planLabel = u.status === "active" ? (u.plan ?? "—") : statusLabel(u.status, isBn);
                  const planVariant: "default" | "secondary" | "destructive" =
                    u.status === "active"
                      ? "default"
                      : u.status === "revoked"
                        ? "destructive"
                        : "secondary";
                  return (
                    <Card key={u.user_id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1.5 text-sm min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-semibold truncate">
                              {u.full_name || u.company_name || "—"}
                            </div>
                            {u.roles?.map((r) => (
                              <Badge
                                key={r}
                                variant={r === "super_admin" ? "destructive" : "outline"}
                                className="text-[10px]"
                              >
                                {r}
                              </Badge>
                            ))}
                          </div>
                          {u.company_name && (
                            <div className="text-muted-foreground flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{u.company_name}</span>
                            </div>
                          )}
                          {u.phone && (
                            <div className="text-muted-foreground flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              <span className="font-mono">{u.phone}</span>
                            </div>
                          )}
                          {u.email && (
                            <div className="text-muted-foreground flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{u.email}</span>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground pt-1">
                            {isBn ? "যোগদান" : "Joined"}: {formatDateTime(u.created_at)}
                            {u.expires_at && (
                              <> {" · "}{isBn ? "মেয়াদ" : "Expires"}: {formatDateTime(u.expires_at)}</>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Badge variant={planVariant}>{planLabel}</Badge>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {formatNumber(Number(u.message_credits))} {isBn ? "ক্রেডিট" : "credits"}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
