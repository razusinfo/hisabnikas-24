import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/purchases")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: ["purchases"], queryFn: fetchPurchases });
  },
  component: PurchasesPage,
});

async function fetchPurchases() {
  const { data, error } = await (supabase as any)
    .from("purchases")
    .select("id,invoice_no,total,paid,due,payment_method,status,created_at,supplier_name")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

function PurchasesPage() {
  const { t } = useI18n();
  const { data } = useSuspenseQuery({ queryKey: ["purchases"], queryFn: fetchPurchases });

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader title={t("purchases")} subtitle="All purchase orders and supplier bills." />

      <div className="card-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
            <tr className="text-left">
              <th className="py-3 px-4">{t("invoice")}</th>
              <th className="py-3 px-4">{t("date")}</th>
              <th className="py-3 px-4">Supplier</th>
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
            {data.map((p: any) => (
              <tr key={p.id} className="border-t border-border/40 hover:bg-muted/30">
                <td className="py-3 px-4 font-mono">{p.invoice_no}</td>
                <td className="py-3 px-4 text-muted-foreground">{fmtDateTime(p.created_at)}</td>
                <td className="py-3 px-4">{p.supplier_name || <span className="text-muted-foreground">—</span>}</td>
                <td className="py-3 px-4 capitalize">{p.payment_method}</td>
                <td className="py-3 px-4 text-right font-mono">{fmtMoney(p.total)}</td>
                <td className="py-3 px-4 text-right font-mono text-success">{fmtMoney(p.paid)}</td>
                <td className="py-3 px-4 text-right font-mono">{Number(p.due) > 0 ? <span className="text-warning">{fmtMoney(p.due)}</span> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
