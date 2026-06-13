import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtNum } from "@/lib/format";
import { Plus, Search, Trash2, Package, Pencil, Boxes, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  cost_price: number;
  sell_price: number;
  stock: number;
  low_stock_threshold: number;
  category_id: string | null;
};

type Category = { id: string; name: string };

const emptyForm = {
  name: "", sku: "", barcode: "", unit: "pcs",
  cost_price: "0", sell_price: "0", stock: "0", low_stock_threshold: "5",
  category_id: "",
};

async function fetchProducts() {
  const { data, error } = await supabase
    .from("products").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories").select("id,name").order("name", { ascending: true });
  if (error) throw error;
  return data as Category[];
}

export const Route = createFileRoute("/_authenticated/products")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({ queryKey: ["products"], queryFn: fetchProducts }),
      context.queryClient.ensureQueryData({ queryKey: ["categories"], queryFn: fetchCategories }),
    ]);
  },
  component: ProductsPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function ProductsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: categories } = useSuspenseQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"new" | "name" | "stock" | "price">("new");
  const [lowOnly, setLowOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Add / edit dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Stock adjust dialog
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [stockVal, setStockVal] = useState("0");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku ?? "", barcode: p.barcode ?? "", unit: p.unit,
      cost_price: String(p.cost_price), sell_price: String(p.sell_price),
      stock: String(p.stock), low_stock_threshold: String(p.low_stock_threshold),
      category_id: p.category_id ?? "",
    });
    setOpen(true);
  };

  const addCategory = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error(t("name"));
      const { data: u } = await supabase.auth.getUser();
      const { data: row, error } = await supabase
        .from("categories")
        .insert({ name: trimmed, owner_id: u.user!.id })
        .select("id,name")
        .single();
      if (error) throw error;
      return row as Category;
    },
    onSuccess: (row) => {
      toast.success(t("categoryCreated"));
      setNewCategoryName("");
      qc.invalidateQueries({ queryKey: ["categories"] });
      setForm((f) => ({ ...f, category_id: row.id }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        unit: form.unit.trim() || "pcs",
        cost_price: Number(form.cost_price) || 0,
        sell_price: Number(form.sell_price) || 0,
        stock: Number(form.stock) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        category_id: form.category_id || null,
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("products").insert({ ...payload, owner_id: u.user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? t("productUpdated") : t("productCreated"));
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjust = useMutation({
    mutationFn: async () => {
      if (!stockTarget) return;
      const newStock = Number(stockVal);
      if (!Number.isFinite(newStock) || newStock < 0) throw new Error(t("enterValidAmount"));
      const { error } = await supabase.from("products").update({ stock: newStock }).eq("id", stockTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("stockAdjusted"));
      setStockTarget(null);
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
    onSuccess: () => {
      toast.success(t("productDeleted"));
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const categoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? "—") : "";

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let arr = data.filter((p) => {
      const matches = !q || [p.name, p.sku, p.barcode].some((v) => v?.toLowerCase().includes(q));
      const low = Number(p.stock) <= Number(p.low_stock_threshold);
      const catOk = categoryFilter === "all" || p.category_id === categoryFilter;
      return matches && (!lowOnly || low) && catOk;
    });
    arr = [...arr];
    if (sort === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "stock") arr.sort((a, b) => Number(a.stock) - Number(b.stock));
    if (sort === "price") arr.sort((a, b) => Number(b.sell_price) - Number(a.sell_price));
    return arr;
  }, [data, search, lowOnly, sort, categoryFilter]);

  const totalCount = data.length;
  const lowCount = data.filter((p) => Number(p.stock) <= Number(p.low_stock_threshold)).length;
  const stockValue = data.reduce((s, p) => s + Number(p.stock) * Number(p.cost_price), 0);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t("products")}
        subtitle={t("productsSubtitle")}
        actions={
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />{t("addProduct")}</Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="card-premium p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Boxes className="h-5 w-5 text-primary" /></div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("totalProductsLabel")}</div>
            <div className="font-display font-semibold text-lg">{fmtNum(totalCount, lang)}</div>
          </div>
        </div>
        <div className="card-premium p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("lowStock")}</div>
            <div className="font-display font-semibold text-lg">{fmtNum(lowCount, lang)}</div>
          </div>
        </div>
        <div className="card-premium p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Package className="h-5 w-5 text-primary" /></div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("totalStockValue")}</div>
            <div className="font-display font-semibold text-lg">{fmtMoney(stockValue, lang)}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-premium p-4 mb-4 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-muted-foreground ml-2" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="border-0 bg-transparent focus-visible:ring-0" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategories")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={lowOnly ? "low" : "all"} onValueChange={(v) => setLowOnly(v === "low")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all")}</SelectItem>
            <SelectItem value="low">{t("lowStockOnly")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="new">{t("sortNewest")}</SelectItem>
            <SelectItem value="name">{t("sortNameAZ")}</SelectItem>
            <SelectItem value="stock">{t("sortStockLow")}</SelectItem>
            <SelectItem value="price">{t("sortPriceHigh")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 && (
          <div className="col-span-full card-premium p-12 text-center text-muted-foreground">{t("noData")}</div>
        )}
        {filtered.map((p) => {
          const low = Number(p.stock) <= Number(p.low_stock_threshold);
          return (
            <div key={p.id} className="card-premium p-3.5 group">
              <div className="flex items-start justify-between">
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <Button size="icon" variant="ghost" className="h-7 w-7" title={t("adjustStock")} onClick={() => { setStockTarget(p); setStockVal(String(p.stock)); }}><Boxes className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title={t("edit")} onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title={t("delete")} onClick={() => setDeleteTarget(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="mt-3">
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">{p.sku || p.barcode || "—"}</div>
                {p.category_id && (
                  <div className="inline-block mt-1.5 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {categoryName(p.category_id)}
                  </div>
                )}
              </div>
              <div className="flex items-end justify-between mt-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("price")}</div>
                  <div className="font-display font-semibold text-sm">{fmtMoney(p.sell_price, lang)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("stock")}</div>
                  <div className={`font-mono font-semibold text-sm ${low ? "text-destructive" : ""}`}>{fmtNum(p.stock, lang)} {p.unit}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? t("editProduct") : t("addProduct")}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
            <div className="space-y-1.5"><Label>{t("name")}</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{t("sku")}</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("barcode")}</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>{t("cost")}</Label><Input type="number" step="0.01" min="0" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("price")}</Label><Input type="number" step="0.01" min="0" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("stock")}</Label><Input type="number" step="0.01" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} disabled={!!editing} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{t("unit")}</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("lowStockAlert")}</Label><Input type="number" min="0" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("category")}</Label>
              <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("noCategory")}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 pt-1">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t("newCategory")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addCategory.mutate(newCategoryName); }
                  }}
                />
                <Button type="button" variant="outline" disabled={addCategory.isPending || !newCategoryName.trim()} onClick={() => addCategory.mutate(newCategoryName)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={save.isPending}>{t("save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust stock */}
      <Dialog open={!!stockTarget} onOpenChange={(o) => !o && setStockTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("adjustStock")}</DialogTitle></DialogHeader>
          {stockTarget && (
            <form onSubmit={(e) => { e.preventDefault(); adjust.mutate(); }} className="space-y-3">
              <div className="text-sm text-muted-foreground">{stockTarget.name}</div>
              <div className="space-y-1.5">
                <Label>{t("newStock")}</Label>
                <Input type="number" step="0.01" min="0" value={stockVal} onChange={(e) => setStockVal(e.target.value)} autoFocus />
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setStockTarget(null)}>{t("cancel")}</Button>
                <Button type="submit" disabled={adjust.isPending}>{t("save")}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteProductTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteProductDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && del.mutate(deleteTarget.id)}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
