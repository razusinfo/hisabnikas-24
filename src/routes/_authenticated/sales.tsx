import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/sales")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: ["sales"], queryFn: fetchSales });
  },
  component: SalesPage,
});

async function fetchSales() {
  const { data, error } = await supabase
    .from("sales")
    .select("id,invoice_no,total,paid,due,payment_method,status,created_at,customers(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

function SalesPage() {
  const { t } = useI18n();
  const { data } = useSuspenseQuery({ queryKey: ["sales"], queryFn: fetchSales });

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader title={t("sales")} subtitle="Every transaction, neatly archived." />

      <div className="card-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
            <tr className="text-left">
              <th className="py-3 px-4">{t("invoice")}</th>
              <th className="py-3 px-4">{t("date")}</th>
              <th className="py-3 px-4">{t("customer")}</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4 text-right">{t("total")}</th>
              <th className="py-3 px-4 text-right">{t("paid")}</th>
              <th className="py-3 px-4 text-right">{t("due")}</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">{t("noData")}</td></tr>
            )}
            {data.map((s: any) => (
              <tr key={s.id} className="border-t border-border/40 hover:bg-muted/30">
                <td className="py-3 px-4 font-mono">{s.invoice_no}</td>
                <td className="py-3 px-4 text-muted-foreground">{fmtDateTime(s.created_at)}</td>
                <td className="py-3 px-4">{s.customers?.name || <span className="text-muted-foreground">Walk-in</span>}</td>
                <td className="py-3 px-4 capitalize">{s.payment_method}</td>
                <td className="py-3 px-4 text-right font-mono">{fmtMoney(s.total)}</td>
                <td className="py-3 px-4 text-right font-mono text-success">{fmtMoney(s.paid)}</td>
                <td className="py-3 px-4 text-right font-mono">{Number(s.due) > 0 ? <span className="text-warning">{fmtMoney(s.due)}</span> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
