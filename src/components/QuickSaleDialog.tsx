import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, Minus, Search, UserPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fmtMoney } from "@/lib/format";

type Line = { product_id: string; name: string; qty: number; unit_price: number; stock: number };

export function QuickSaleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const [customerId, setCustomerId] = useState<string>("walkin");
  const [method, setMethod] = useState("cash");
  const [discount, setDiscount] = useState("0");
  const [paid, setPaid] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name,sku,sell_price,stock").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id,name,phone").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const subtotal = lines.reduce((a, l) => a + l.qty * l.unit_price, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));
  const paidAmt = paid === "" ? total : Number(paid);
  const due = Math.max(0, total - paidAmt);

  const filteredProducts = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return (products as any[]).slice(0, 8);
    return (products as any[]).filter((p) =>
      `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(s)
    ).slice(0, 8);
  }, [products, search]);

  function reset() {
    setCustomerId("walkin"); setMethod("cash"); setDiscount("0"); setPaid(""); setLines([]); setSearch("");
  }

  function addLine(p: any) {
    setSearch("");
    setLines((ls) => {
      const exists = ls.find((l) => l.product_id === p.id);
      if (exists) return ls.map((l) => l.product_id === p.id ? { ...l, qty: l.qty + 1 } : l);
      return [...ls, { product_id: p.id, name: p.name, qty: 1, unit_price: Number(p.sell_price || 0), stock: Number(p.stock || 0) }];
    });
  }

  function updateQty(idx: number, qty: number) {
    setLines((ls) => ls.map((l, i) => i === idx ? { ...l, qty: Math.max(1, qty) } : l));
  }

  async function createSale() {
    if (lines.length === 0) return toast.error(t("cartEmpty"));
    for (const l of lines) if (l.qty > l.stock) return toast.error(`${l.name}: ${t("insufficientStock")}`);
    setCreating(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const invoice_no = "INV-" + Date.now().toString().slice(-8);
      const status = due <= 0 ? "paid" : paidAmt > 0 ? "partial" : "due";
      const { data: sale, error } = await supabase.from("sales").insert({
        owner_id: u.user!.id,
        customer_id: customerId === "walkin" ? null : customerId,
        invoice_no,
        subtotal,
        discount: Number(discount || 0),
        tax: 0,
        total,
        paid: paidAmt,
        due,
        payment_method: method,
        status,
      }).select().single();
      if (error) throw error;
      const rows = lines.map((l) => ({
        sale_id: sale.id,
        owner_id: u.user!.id,
        product_id: l.product_id,
        product_name: l.name,
        qty: l.qty,
        unit_price: l.unit_price,
        line_total: l.qty * l.unit_price,
      }));
      const { error: e2 } = await supabase.from("sale_items").insert(rows);
      if (e2) throw e2;
      toast.success(t("saleRecorded"));
      reset();
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-list"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("newSale")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="walkin">{t("walkIn")}</SelectItem>
                {(customers as any[]).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t("methodCash")}</SelectItem>
                <SelectItem value="card">{t("methodCard")}</SelectItem>
                <SelectItem value="bkash">bKash</SelectItem>
                <SelectItem value="nagad">Nagad</SelectItem>
                <SelectItem value="bank">{t("methodBank")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="পণ্য খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {(search || filteredProducts.length > 0) && (
              <div className="mt-2 border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">{t("noData")}</div>
                ) : filteredProducts.map((p: any) => (
                  <button key={p.id} type="button" onClick={() => addLine(p)} className="w-full text-left p-2.5 hover:bg-muted/50 flex items-center justify-between text-sm">
                    <span className="truncate">{p.name} <span className="text-xs text-muted-foreground">({p.stock})</span></span>
                    <span className="font-mono">{fmtMoney(p.sell_price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <div className="border border-border rounded-lg divide-y divide-border">
              {lines.map((l, i) => (
                <div key={l.product_id} className="p-2.5 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{l.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{fmtMoney(l.unit_price)} × {l.qty} = {fmtMoney(l.qty * l.unit_price)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i, l.qty - 1)}><Minus className="h-3 w-3" /></Button>
                    <Input className="h-7 w-12 text-center" type="number" value={l.qty} onChange={(e) => updateQty(i, Number(e.target.value))} />
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i, l.qty + 1)}><Plus className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{t("discount")}</label>
              <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("paid")}</label>
              <Input type="number" placeholder={String(total)} value={paid} onChange={(e) => setPaid(e.target.value)} />
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t("subtotal")}</span><span className="font-mono">{fmtMoney(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("discount")}</span><span className="font-mono">-{fmtMoney(Number(discount || 0))}</span></div>
            <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>{t("total")}</span><span className="font-mono">{fmtMoney(total)}</span></div>
            {due > 0 && <div className="flex justify-between text-warning"><span>{t("due")}</span><span className="font-mono">{fmtMoney(due)}</span></div>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button onClick={createSale} disabled={creating || lines.length === 0}>{creating ? "..." : t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
