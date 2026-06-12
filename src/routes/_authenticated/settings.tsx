import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <div className="p-8">
        <PageHeader title={t("settings")} />
        <p className="text-muted-foreground">{t("noData")}</p>
      </div>
    </AppShell>
  );
}
