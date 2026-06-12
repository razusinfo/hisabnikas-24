import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/current-package")({
  component: CurrentPackagePage,
});

function CurrentPackagePage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <div className="p-8 max-w-3xl">
        <PageHeader title={t("currentPackage")} />
        <Card className="p-6 flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-display font-semibold">Free</div>
            <p className="text-sm text-muted-foreground mt-1">{t("noData")}</p>
            <Button className="mt-4">{t("subscribe")}</Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
