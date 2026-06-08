import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { fmtMoney } from "@/lib/format";
import { Plus, Search, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: ["products"], queryFn: fetchProducts });
  },
  component: ProductsPage,
});

async function fetchProducts() {
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

function ProductsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", sku: "", barcode: "", unit: "pcs",
    cost_price: "0", sell_price: "0", stock: "0", low_stock_threshold: "5",
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("products").insert({
        owner_id: u.user!.id,
        name: form.name,
        sku: form.sku || null,
        barcode: form.barcode || null,
        unit: form.unit,
        cost_price: Number(form.cost_price),
        sell_price: Number(form.sell_price),
        stock: Number(form.stock),
        low_stock_threshold: Number(form.low_stock_threshold),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product added");
      setOpen(false);
      setForm({ name: "", sku: "", barcode: "", unit: "pcs", cost_price: "0", sell_price: "0", stock: "0", low_stock_threshold: "5" });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["products"] }); },
  });

  const filtered = data.filter((p) =>
    [p.name, p.sku, p.barcode].some((v) => v?.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t("products")}
        subtitle="Your catalog, stock, and pricing — all in one ledger."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> {t("addProduct")}</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{t("addProduct")}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
                <div className="space-y-1.5"><Label>{t("name")}</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>{t("sku")}</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>{t("barcode")}</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5"><Label>{t("cost")}</Label><Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>{t("price")}</Label><Input type="number" step="0.01" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>{t("stock")}</Label><Input type="number" step="0.01" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Low Stock Alert</Label><Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} /></div>
                </div>
                <Button disabled={create.isPending} className="w-full">{t("save")}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="card-premium p-4 mb-4 flex items-center gap-3">
        <Search className="h-4 w-4 text-muted-foreground ml-2" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="border-0 bg-transparent focus-visible:ring-0" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-full card-premium p-12 text-center text-muted-foreground">{t("noData")}</div>
        )}
        {filtered.map((p) => {
          const low = Number(p.stock) <= Number(p.low_stock_threshold);
          return (
            <div key={p.id} className="card-premium p-5 group">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(p.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="mt-4">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">{p.sku || p.barcode || "—"}</div>
              </div>
              <div className="flex items-end justify-between mt-4">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("price")}</div>
                  <div className="font-display font-semibold">{fmtMoney(p.sell_price)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("stock")}</div>
                  <div className={`font-mono font-semibold ${low ? "text-destructive" : ""}`}>{Number(p.stock)} {p.unit}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
