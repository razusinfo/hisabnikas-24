import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/DateInput";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtNum } from "@/lib/format";
import { Plus, Search, Trash2, Package, Pencil, Boxes, AlertTriangle, Image as ImageIcon, Upload, X, ShoppingCart, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryManagerDialog } from "@/components/CategoryManagerDialog";

import { useAppSettings } from "@/lib/app-settings";

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
  image_url: string | null;
  vat: number | null;
  mrp: number | null;
  batch_no: string | null;
  serial_no: string | null;
  size: string | null;
  expiry_date: string | null;
};

type Category = { id: string; name: string };

const emptyForm = {
  name: "", sku: "", barcode: "", unit: "pcs",
  cost_price: "0", sell_price: "0", stock: "0", low_stock_threshold: "5",
  category_id: "", image_url: "" as string,
  vat: "0", mrp: "", batch_no: "", serial_no: "", size: "", expiry_date: "",
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
  errorComponent: ({ error }) => { console.error(error); return <div className="p-8 text-destructive">Something went wrong loading this page.</div>; },
  notFoundComponent: () => <div className="p-4 sm:p-6 lg:p-8">Not found</div>,
});

function ProductsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: categories } = useSuspenseQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: appSettings } = useAppSettings();
  const sett = {
    barcodeScan: appSettings?.barcodeScan !== false,
    itemUnit: appSettings?.itemUnit !== false,
    itemCategory: appSettings?.itemCategory !== false,
    showPurchasePrice: appSettings?.showPurchasePrice !== false,
    showSalePrice: appSettings?.showSalePrice !== false,
    lowStockAlert: appSettings?.lowStockAlert !== false,
    vat: appSettings?.vat === true,
    mrpPrice: appSettings?.mrpPrice === true,
    batchNumber: appSettings?.batchNumber === true,
    serialImei: appSettings?.serialImei === true,
    size: appSettings?.size === true,
    expiryDate: appSettings?.expiryDate === true,
  };


  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const [sort, setSort] = useState<"new" | "name" | "stock" | "price">("new");
  const [lowOnly, setLowOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Add / edit dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [manageCatOpen, setManageCatOpen] = useState(false);

  // Stock adjust dialog
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [stockVal, setStockVal] = useState("0");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Image upload
  const [uploading, setUploading] = useState(false);
  const handleImageUpload = async (file: File) => {
    try {
      setUploading(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${u.user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
      if (error) throw error;
      setForm((f) => ({ ...f, image_url: path }));
      toast.success("✓");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  // Signed URLs for product images (private bucket)
  const imagePaths = useMemo(
    () => Array.from(new Set(data.map((p) => p.image_url).filter(Boolean) as string[])),
    [data],
  );
  const signedQuery = useQuery({
    queryKey: ["product-image-urls", imagePaths],
    enabled: imagePaths.length > 0,
    queryFn: async () => {
      const map: Record<string, string> = {};
      await Promise.all(
        imagePaths.map(async (p) => {
          const { data } = await supabase.storage.from("product-images").createSignedUrl(p, 60 * 60);
          if (data?.signedUrl) map[p] = data.signedUrl;
        }),
      );
      return map;
    },
  });
  const signedMap = signedQuery.data ?? {};

  // Signed URL for current form preview
  const formImageQuery = useQuery({
    queryKey: ["product-image-form", form.image_url],
    enabled: !!form.image_url,
    queryFn: async () => {
      const { data } = await supabase.storage.from("product-images").createSignedUrl(form.image_url, 60 * 60);
      return data?.signedUrl ?? null;
    },
  });

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
      category_id: p.category_id ?? "", image_url: p.image_url ?? "",
      vat: p.vat != null ? String(p.vat) : "0",
      mrp: p.mrp != null ? String(p.mrp) : "",
      batch_no: p.batch_no ?? "",
      serial_no: p.serial_no ?? "",
      size: p.size ?? "",
      expiry_date: p.expiry_date ?? "",
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
        image_url: form.image_url || null,
        vat: Number(form.vat) || 0,
        mrp: form.mrp === "" ? null : Number(form.mrp),
        batch_no: form.batch_no.trim() || null,
        serial_no: form.serial_no.trim() || null,
        size: form.size.trim() || null,
        expiry_date: form.expiry_date || null,
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t("products")}
        subtitle={t("productsSubtitle")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/sales", search: { new: 1 } })}><ShoppingCart className="h-4 w-4 mr-2" />{t("newSale")}</Button>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />{t("addProduct")}</Button>
          </div>
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
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategories")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={lowOnly ? "low" : "all"} onValueChange={(v) => setLowOnly(v === "low")}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all")}</SelectItem>
            <SelectItem value="low">{t("lowStockOnly")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="new">{t("sortNewest")}</SelectItem>
            <SelectItem value="name">{t("sortNameAZ")}</SelectItem>
            <SelectItem value="stock">{t("sortStockLow")}</SelectItem>
            <SelectItem value="price">{t("sortPriceHigh")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {filtered.length === 0 && (
          <div className="col-span-full card-premium p-12 text-center text-muted-foreground">{t("noData")}</div>
        )}
        {filtered.map((p) => {
          const low = Number(p.stock) <= Number(p.low_stock_threshold);
          return (
            <div key={p.id} className="card-premium p-2 group">
              <div className="flex items-start justify-between gap-1">
                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                  {p.image_url && signedMap[p.image_url] ? (
                    <img src={signedMap[p.image_url]} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
                <div className="flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:transition">
                  <Button size="icon" variant="ghost" className="h-5 w-5" title={t("adjustStock")} onClick={() => { setStockTarget(p); setStockVal(String(p.stock)); }}><Boxes className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" title={t("edit")} onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" title={t("delete")} onClick={() => setDeleteTarget(p)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
              <div className="mt-1.5">
                <div className="font-medium text-xs leading-tight line-clamp-2">{p.name}</div>
              </div>
              <div className="flex items-end justify-between mt-1.5 gap-1">
                <div className="font-display font-semibold text-xs">{fmtMoney(p.sell_price, lang)}</div>
                <div className={`font-mono text-[11px] ${low ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{fmtNum(p.stock, lang)}{p.unit ? ` ${p.unit}` : ""}</div>
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
            <div className="space-y-1.5">
              <Label>ছবি / Image</Label>
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                  {formImageQuery.data ? (
                    <img src={formImageQuery.data} alt="preview" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex gap-2 flex-1">
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f);
                        e.target.value = "";
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                      <span><Upload className="h-3.5 w-3.5 mr-1.5" />{uploading ? "..." : "Upload"}</span>
                    </Button>
                  </label>
                  {form.image_url && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, image_url: "" }))}>
                      <X className="h-3.5 w-3.5 mr-1.5" />Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-1.5"><Label>{t("name")}</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{t("sku")}</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              {sett.barcodeScan && (
                <div className="space-y-1.5"><Label>{t("barcode")}</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {sett.showPurchasePrice && (
                <div className="space-y-1.5"><Label>{t("cost")}</Label><Input type="number" step="0.01" min="0" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>
              )}
              {sett.showSalePrice && (
                <div className="space-y-1.5"><Label>{t("price")}</Label><Input type="number" step="0.01" min="0" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} /></div>
              )}
              <div className="space-y-1.5"><Label>{t("stock")}</Label><Input type="number" step="0.01" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} disabled={!!editing} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {sett.itemUnit && (
                <div className="space-y-1.5"><Label>{t("unit")}</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
              )}
              {sett.lowStockAlert && (
                <div className="space-y-1.5"><Label>{t("lowStockAlert")}</Label><Input type="number" min="0" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} /></div>
              )}
            </div>
            {sett.itemCategory && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{t("category")}</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setManageCatOpen(true)}>
                  <Settings2 className="h-3.5 w-3.5 mr-1" />{t("manageCategories")}
                </Button>
              </div>
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
            )}
            {(sett.vat || sett.mrpPrice) && (
              <div className="grid grid-cols-2 gap-3">
                {sett.vat && (
                  <div className="space-y-1.5"><Label>{lang === "bn" ? "ভ্যাট (%)" : "VAT (%)"}</Label><Input type="number" step="0.01" min="0" value={form.vat} onChange={(e) => setForm({ ...form, vat: e.target.value })} /></div>
                )}
                {sett.mrpPrice && (
                  <div className="space-y-1.5"><Label>MRP</Label><Input type="number" step="0.01" min="0" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} /></div>
                )}
              </div>
            )}
            {(sett.batchNumber || sett.serialImei) && (
              <div className="grid grid-cols-2 gap-3">
                {sett.batchNumber && (
                  <div className="space-y-1.5"><Label>{lang === "bn" ? "ব্যাচ নম্বর" : "Batch"}</Label><Input value={form.batch_no} onChange={(e) => setForm({ ...form, batch_no: e.target.value })} /></div>
                )}
                {sett.serialImei && (
                  <div className="space-y-1.5"><Label>{lang === "bn" ? "সিরিয়াল / আইএমইআই" : "Serial / IMEI"}</Label><Input value={form.serial_no} onChange={(e) => setForm({ ...form, serial_no: e.target.value })} /></div>
                )}
              </div>
            )}
            {(sett.size || sett.expiryDate) && (
              <div className="grid grid-cols-2 gap-3">
                {sett.size && (
                  <div className="space-y-1.5"><Label>{lang === "bn" ? "সাইজ" : "Size"}</Label><Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></div>
                )}
                {sett.expiryDate && (
                  <div className="space-y-1.5"><Label>{lang === "bn" ? "মেয়াদ উত্তীর্ণের তারিখ" : "Expiry date"}</Label><DateInput value={form.expiry_date} onChange={(v) => setForm({ ...form, expiry_date: v })} /></div>
                )}
              </div>
            )}
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

      <CategoryManagerDialog open={manageCatOpen} onOpenChange={setManageCatOpen} />
    </div>
  );
}
