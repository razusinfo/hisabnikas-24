import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/buy-messages")({
  component: BuyMessagesPage,
});

function BuyMessagesPage() {
  const { t } = useI18n();
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title={t("buyMessages")} />
      <p className="text-muted-foreground">{t("noData")}</p>
    </div>
  );
}
