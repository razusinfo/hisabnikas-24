import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAppSettings } from "@/lib/app-settings";
import { fetchCategories } from "@/routes/_authenticated/products";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image as ImageIcon, Upload, X, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryManagerDialog } from "@/components/CategoryManagerDialog";

export type ProductFormEditing = {
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
} | null;

export type CreatedProduct = {
  id: string;
  name: string;
  sell_price: number;
  cost_price: number;
  stock: number;
  category_id: string | null;
};

const emptyForm = {
  name: "", sku: "", barcode: "", unit: "pcs",
  cost_price: "0", sell_price: "0", stock: "0", low_stock_threshold: "5",
  category_id: "", image_url: "" as string,
  vat: "0", mrp: "", batch_no: "", serial_no: "", size: "", expiry_date: "",
};

export function ProductFormDialog({
  open,
  onOpenChange,
  editing = null,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: ProductFormEditing;
  onCreated?: (p: CreatedProduct) => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
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

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    enabled: open,
  });

  const [form, setForm] = useState(emptyForm);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [manageCatOpen, setManageCatOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name, sku: editing.sku ?? "", barcode: editing.barcode ?? "", unit: editing.unit,
        cost_price: String(editing.cost_price), sell_price: String(editing.sell_price),
        stock: String(editing.stock), low_stock_threshold: String(editing.low_stock_threshold),
        category_id: editing.category_id ?? "", image_url: editing.image_url ?? "",
        vat: editing.vat != null ? String(editing.vat) : "0",
        mrp: editing.mrp != null ? String(editing.mrp) : "",
        batch_no: editing.batch_no ?? "",
        serial_no: editing.serial_no ?? "",
        size: editing.size ?? "",
        expiry_date: editing.expiry_date ?? "",
      });
    } else {
      setForm(emptyForm);
    }
    setNewCategoryName("");
  }, [open, editing]);

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

  const formImageQuery = useQuery({
    queryKey: ["product-image-form", form.image_url],
    enabled: !!form.image_url,
    queryFn: async () => {
      const { data } = await supabase.storage.from("product-images").createSignedUrl(form.image_url, 60 * 60);
      return data?.signedUrl ?? null;
    },
  });

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
      return row as { id: string; name: string };
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
        return null;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { data: row, error } = await supabase
          .from("products")
          .insert({ ...payload, owner_id: u.user!.id })
          .select("id,name,sell_price,cost_price,stock,category_id")
          .single();
        if (error) throw error;
        return row as CreatedProduct;
      }
    },
    onSuccess: (row) => {
      toast.success(editing ? t("productUpdated") : t("productCreated"));
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-list"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (row && onCreated) onCreated(row);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <div className="space-y-1.5"><Label>ভ্যাট (%) / VAT</Label><Input type="number" step="0.01" min="0" value={form.vat} onChange={(e) => setForm({ ...form, vat: e.target.value })} /></div>
              )}
              {sett.mrpPrice && (
                <div className="space-y-1.5"><Label>MRP</Label><Input type="number" step="0.01" min="0" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} /></div>
              )}
            </div>
          )}
          {(sett.batchNumber || sett.serialImei) && (
            <div className="grid grid-cols-2 gap-3">
              {sett.batchNumber && (
                <div className="space-y-1.5"><Label>ব্যাচ নম্বর / Batch</Label><Input value={form.batch_no} onChange={(e) => setForm({ ...form, batch_no: e.target.value })} /></div>
              )}
              {sett.serialImei && (
                <div className="space-y-1.5"><Label>সিরিয়াল / IMEI</Label><Input value={form.serial_no} onChange={(e) => setForm({ ...form, serial_no: e.target.value })} /></div>
              )}
            </div>
          )}
          {(sett.size || sett.expiryDate) && (
            <div className="grid grid-cols-2 gap-3">
              {sett.size && (
                <div className="space-y-1.5"><Label>সাইজ / Size</Label><Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></div>
              )}
              {sett.expiryDate && (
                <div className="space-y-1.5"><Label>মেয়াদ উত্তীর্ণের তারিখ / Expiry</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>{t("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <CategoryManagerDialog open={manageCatOpen} onOpenChange={setManageCatOpen} />
    </Dialog>
  );
}
