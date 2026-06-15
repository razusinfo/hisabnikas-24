import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-payments")({
  component: AdminPaymentsPage,
});

function AdminPaymentsPage() {
  const qc = useQueryClient();
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  const meAdmin = useQuery({
    queryKey: ["is-super-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase
        .from("profiles")
        .select("is_super_admin")
        .eq("id", u.user.id)
        .maybeSingle();
      return !!(data as any)?.is_super_admin;
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

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("approve_payment_request", {
        _request_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("অনুমোদিত — গ্রাহকের প্যাকেজ চালু হয়েছে");
      qc.invalidateQueries({ queryKey: ["all-payment-requests"] });
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
        subtitle="বিকাশ পেমেন্ট যাচাই করে প্যাকেজ অনুমোদন করুন"
      />

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
                    {new Date(r.created_at).toLocaleString("bn-BD")}
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
    </div>
  );
}
