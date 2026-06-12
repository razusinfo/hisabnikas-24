import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/help")({
  component: HelpPage,
});

function HelpPage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <div className="p-8">
        <PageHeader title={t("helpSupport")} />
        <p className="text-muted-foreground">{t("noData")}</p>
      </div>
    </AppShell>
  );
}
