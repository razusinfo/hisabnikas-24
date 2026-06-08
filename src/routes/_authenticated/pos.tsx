import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { fmtMoney } from "@/lib/format";
import { Plus, Minus, X, Search, ScanBarcode } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pos")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({ queryKey: ["products"], queryFn: fetchProducts }),
      context.queryClient.ensureQueryData({ queryKey: ["customers"], queryFn: fetchCustomers }),
    ]);
  },
  component: POSPage,
});

async function fetchProducts() {
  const { data, error } = await supabase.from("products").select("id,name,sku,barcode,sell_price,stock,unit").eq("is_active", true);
  if (error) throw error;
  return data;
}
async function fetchCustomers() {
  const { data, error } = await supabase.from("customers").select("id,name").order("name");
  if (error) throw error;
  return data;
}

type Line = { product_id: string; name: string; qty: number; unit_price: number };

function POSPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: products } = useSuspenseQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: customers } = useSuspenseQuery({ queryKey: ["customers"], queryFn: fetchCustomers });

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState("cash");
  const [customerId, setCustomerId] = useState<string | undefined>();

  const filtered = useMemo(
    () => products.filter((p) => [p.name, p.sku, p.barcode].some((v) => v?.toLowerCase().includes(search.toLowerCase()))),
    [products, search],
  );

  const add = (p: typeof products[number]) => {
    setCart((prev) => {
      const ex = prev.find((l) => l.product_id === p.id);
      if (ex) return prev.map((l) => l.product_id === p.id ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { product_id: p.id, name: p.name, qty: 1, unit_price: Number(p.sell_price) }];
    });
  };
  const updateQty = (id: string, q: number) => {
    if (q <= 0) return setCart((c) => c.filter((l) => l.product_id !== id));
    setCart((c) => c.map((l) => l.product_id === id ? { ...l, qty: q } : l));
  };

  const subtotal = cart.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const total = Math.max(0, subtotal - Number(discount || 0) + Number(tax || 0));
  const paidAmt = paid === "" ? total : Number(paid);
  const due = Math.max(0, total - paidAmt);

  const checkout = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Cart is empty");
      const { data: u } = await supabase.auth.getUser();
      const invoice_no = "INV-" + Date.now().toString().slice(-8);
      const { data: sale, error } = await supabase.from("sales").insert({
        owner_id: u.user!.id,
        customer_id: customerId || null,
        invoice_no,
        subtotal, discount: Number(discount || 0), tax: Number(tax || 0),
        total, paid: paidAmt, due,
        payment_method: method,
      }).select().single();
      if (error) throw error;
      const items = cart.map((l) => ({
        sale_id: sale.id,
        owner_id: u.user!.id,
        product_id: l.product_id,
        product_name: l.name,
        qty: l.qty,
        unit_price: l.unit_price,
        line_total: l.qty * l.unit_price,
      }));
      const { error: e2 } = await supabase.from("sale_items").insert(items);
      if (e2) throw e2;
      return invoice_no;
    },
    onSuccess: (inv) => {
      toast.success(`Sale ${inv} recorded`);
      setCart([]); setDiscount("0"); setTax("0"); setPaid(""); setCustomerId(undefined);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="h-[calc(100vh-0px)] flex flex-col lg:flex-row gap-4 p-6">
      {/* Catalog */}
      <div className="flex-1 flex flex-col min-w-0">
        <PageHeader title={t("pos")} subtitle="Scan, tap, sell. Fast." />

        <div className="card-premium p-3 mb-4 flex items-center gap-2">
          <ScanBarcode className="h-4 w-4 text-primary ml-2" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Scan barcode or search product…"
            className="border-0 bg-transparent focus-visible:ring-0 text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const exact = products.find((p) => p.barcode === search || p.sku === search);
                if (exact) { add(exact); setSearch(""); }
              }
            }}
          />
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-4 pr-1">
          {filtered.length === 0 && (
            <div className="col-span-full card-premium p-10 text-center text-muted-foreground">
              No products. Add some on the Products page.
            </div>
          )}
          {filtered.map((p) => (
            <button key={p.id} onClick={() => add(p)} className="card-premium p-4 text-left hover:ring-1 hover:ring-primary/40 transition-all">
              <div className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{p.name}</div>
              <div className="mt-2 flex items-end justify-between">
                <span className="font-display font-semibold text-primary">{fmtMoney(p.sell_price)}</span>
                <span className="text-xs text-muted-foreground font-mono">{Number(p.stock)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <aside className="w-full lg:w-[380px] card-premium flex flex-col">
        <div className="p-5 border-b border-border">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("cart")}</div>
          <div className="font-display text-2xl font-semibold mt-1">{cart.length} items</div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px]">
          {cart.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10">Tap a product to add it.</div>
          )}
          {cart.map((l) => (
            <div key={l.product_id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{l.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{fmtMoney(l.unit_price)}</div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(l.product_id, l.qty - 1)}><Minus className="h-3 w-3" /></Button>
                <span className="w-8 text-center font-mono text-sm">{l.qty}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(l.product_id, l.qty + 1)}><Plus className="h-3 w-3" /></Button>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => updateQty(l.product_id, 0)}><X className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-border space-y-3">
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue placeholder="Walk-in customer" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">{t("discount")}</Label><Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
            <div><Label className="text-xs">{t("tax")}</Label><Input type="number" value={tax} onChange={(e) => setTax(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Payment</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("cash")}</SelectItem>
                  <SelectItem value="card">{t("card")}</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="bkash">bKash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">{t("paid")}</Label><Input type="number" placeholder={String(total.toFixed(2))} value={paid} onChange={(e) => setPaid(e.target.value)} /></div>
          </div>

          <div className="space-y-1 text-sm py-2 border-t border-border/60">
            <div className="flex justify-between text-muted-foreground"><span>{t("subtotal")}</span><span className="font-mono">{fmtMoney(subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t("discount")}</span><span className="font-mono">-{fmtMoney(Number(discount || 0))}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t("tax")}</span><span className="font-mono">+{fmtMoney(Number(tax || 0))}</span></div>
            <div className="flex justify-between font-display text-lg font-semibold pt-1"><span>{t("total")}</span><span className="text-primary">{fmtMoney(total)}</span></div>
            {due > 0 && <div className="flex justify-between text-warning text-xs"><span>{t("due")}</span><span className="font-mono">{fmtMoney(due)}</span></div>}
          </div>

          <Button disabled={checkout.isPending || cart.length === 0} className="w-full h-12 text-base" onClick={() => checkout.mutate()}>
            {t("completeSale")}
          </Button>
        </div>
      </aside>
    </div>
  );
}
