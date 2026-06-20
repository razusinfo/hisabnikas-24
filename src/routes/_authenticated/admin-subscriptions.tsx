import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Loader2, ShieldOff, Ban, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-subscriptions")({
  component: AdminSubscriptionsPage,
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

function AdminSubscriptionsPage() {
  const qc = useQueryClient();
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
    queryKey: ["all-subscriptions"],
    enabled: !!meAdmin.data,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("list_all_subscriptions");
      if (error) throw error;
      return (data ?? []) as Sub[];
    },
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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = list.data ?? [];
    if (!s) return rows;
    return rows.filter(
      (r) =>
        (r.full_name ?? "").toLowerCase().includes(s) ||
        (r.company_name ?? "").toLowerCase().includes(s) ||
        (r.phone ?? "").toLowerCase().includes(s) ||
        (r.plan ?? "").toLowerCase().includes(s),
    );
  }, [list.data, q]);

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
        title="প্যাকেজ ব্যবস্থাপনা"
        subtitle="শর্ত লঙ্ঘন বা জালিয়াতির ক্ষেত্রে গ্রাহকের প্যাকেজ বাতিল করুন"
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="নাম, প্রতিষ্ঠান, ফোন বা প্ল্যান অনুসারে খুঁজুন"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {list.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          কোনো সাবস্ক্রিপশন পাওয়া যায়নি
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
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
    </div>
  );
}
