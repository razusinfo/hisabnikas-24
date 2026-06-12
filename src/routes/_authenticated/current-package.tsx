import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import { Check, Sparkles, Loader2, Crown, Rocket } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/current-package")({
  component: CurrentPackagePage,
});

type PlanId = "free" | "pro" | "business";

function CurrentPackagePage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [pending, setPending] = useState<PlanId | null>(null);

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

  const subscribe = useMutation({
    mutationFn: async (plan: PlanId) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const now = new Date();
      const expires = plan === "free" ? null : new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
      const { error } = await supabase.from("subscriptions").upsert(
        {
          user_id: u.user.id,
          plan,
          status: "active",
          started_at: now.toISOString(),
          expires_at: expires,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("activated"));
      qc.invalidateQueries({ queryKey: ["subscription"] });
      setPending(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setPending(null);
    },
  });

  const currentPlan = (sub.data?.plan ?? "free") as PlanId;

  const plans: Array<{
    id: PlanId;
    name: string;
    desc: string;
    price: string;
    icon: typeof Sparkles;
    features: Array<keyof typeof featureMap>;
    highlight?: boolean;
  }> = [
    {
      id: "free",
      name: t("planFree"),
      desc: t("planFreeDesc"),
      price: "৳0",
      icon: Sparkles,
      features: ["feat_unlimitedProducts", "feat_unlimitedSales", "feat_basicReports"],
    },
    {
      id: "pro",
      name: t("planPro"),
      desc: t("planProDesc"),
      price: "৳৫০০",
      icon: Rocket,
      highlight: true,
      features: [
        "feat_unlimitedProducts",
        "feat_unlimitedSales",
        "feat_advancedReports",
        "feat_backup",
        "feat_prioritySupport",
      ],
    },
    {
      id: "business",
      name: t("planBusiness"),
      desc: t("planBusinessDesc"),
      price: "৳১৫০০",
      icon: Crown,
      features: [
        "feat_unlimitedProducts",
        "feat_unlimitedSales",
        "feat_advancedReports",
        "feat_backup",
        "feat_prioritySupport",
        "feat_multiUser",
        "feat_customBranding",
      ],
    },
  ];

  return (
    <AppShell>
      <div className="p-8 max-w-6xl">
        <PageHeader title={t("currentPackage")} subtitle={t("packageSubtitle")} />

        {sub.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card className="p-5 mb-6 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("currentPlan")}</div>
                  <div className="font-semibold capitalize">
                    {plans.find((p) => p.id === currentPlan)?.name}
                  </div>
                </div>
              </div>
              {sub.data?.expires_at && (
                <div className="text-sm text-muted-foreground">
                  {t("activeUntil")}: {new Date(sub.data.expires_at).toLocaleDateString()}
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((p) => {
                const Icon = p.icon;
                const isCurrent = currentPlan === p.id;
                return (
                  <Card
                    key={p.id}
                    className={`p-6 relative flex flex-col ${p.highlight ? "ring-2 ring-primary" : ""}`}
                  >
                    {p.highlight && (
                      <Badge className="absolute -top-2 right-4">{t("mostPopular")}</Badge>
                    )}
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-lg font-display font-semibold">{p.name}</div>
                    <p className="text-sm text-muted-foreground">{p.desc}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{p.price}</span>
                      {p.id !== "free" && (
                        <span className="text-sm text-muted-foreground">{t("perMonth")}</span>
                      )}
                    </div>
                    <ul className="mt-5 space-y-2 flex-1">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{t(f)}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="mt-6 w-full"
                      variant={isCurrent ? "outline" : p.highlight ? "default" : "secondary"}
                      disabled={isCurrent || subscribe.isPending}
                      onClick={() => setPending(p.id)}
                    >
                      {isCurrent ? t("currentPlan") : t("subscribe")}
                    </Button>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("subscribeConfirm")}</AlertDialogTitle>
              <AlertDialogDescription>{t("subscribeConfirmDesc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => pending && subscribe.mutate(pending)}>
                {subscribe.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}

const featureMap = {
  feat_unlimitedProducts: true,
  feat_unlimitedSales: true,
  feat_basicReports: true,
  feat_advancedReports: true,
  feat_multiUser: true,
  feat_prioritySupport: true,
  feat_backup: true,
  feat_customBranding: true,
} as const;
