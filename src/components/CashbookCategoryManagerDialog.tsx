import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { toast } from "sonner";

export type CashbookCategory = { id: string; name: string; type: "income" | "expense" };

export async function fetchCashbookCategories(): Promise<CashbookCategory[]> {
  const { data, error } = await (supabase as any)
    .from("cashbook_categories")
    .select("id,name,type")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CashbookCategory[];
}

const PRESETS: Record<"income" | "expense", { bn: string; en: string }[]> = {
  income: [
    { bn: "বিক্রয়", en: "Sales" },
    { bn: "বেতন", en: "Salary" },
    { bn: "পরিষেবা আয়", en: "Service income" },
    { bn: "ভাড়া আয়", en: "Rental income" },
    { bn: "সুদ/লভ্যাংশ", en: "Interest" },
    { bn: "অন্যান্য আয়", en: "Other income" },
  ],
  expense: [
    { bn: "ক্রয়", en: "Purchase" },
    { bn: "বেতন", en: "Salary" },
    { bn: "বাড়ি ভাড়া", en: "Rent" },
    { bn: "বিদ্যুৎ বিল", en: "Electricity" },
    { bn: "পানির বিল", en: "Water" },
    { bn: "ইন্টারনেট", en: "Internet" },
    { bn: "যাতায়াত", en: "Transport" },
    { bn: "খাবার", en: "Food" },
    { bn: "বিজ্ঞাপন", en: "Marketing" },
    { bn: "অন্যান্য খরচ", en: "Other expense" },
  ],
};

export function CashbookCategoryManagerDialog({
  open,
  onOpenChange,
  initialType = "expense",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialType?: "income" | "expense";
}) {
  const { t, lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({
    queryKey: ["cashbook-categories"],
    queryFn: fetchCashbookCategories,
    enabled: open,
  });

  const [tab, setTab] = useState<"income" | "expense">(initialType);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newName, setNewName] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["cashbook-categories"] });

  const addMut = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: "income" | "expense" }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name required");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("cashbook_categories")
        .insert({ name: trimmed, type, owner_id: u.user!.id });
      if (error) throw error;
    },
    onSuccess: () => { setNewName(""); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameMut = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name required");
      const { error } = await (supabase as any).from("cashbook_categories").update({ name: trimmed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { setEditingId(null); setEditingName(""); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("cashbook_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const list = (type: "income" | "expense") => {
    const existing = categories.filter((c) => c.type === type);
    const existingNames = new Set(existing.map((c) => c.name));
    const missingPresets = PRESETS[type].filter((p) => !existingNames.has(bn ? p.bn : p.en));
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder={bn ? "নতুন ক্যাটাগরির নাম" : "New category name"}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMut.mutate({ name: newName, type }); } }}
          />
          <Button
            type="button"
            disabled={!newName.trim() || addMut.isPending}
            onClick={() => addMut.mutate({ name: newName, type })}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {missingPresets.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">{bn ? "দ্রুত যোগ করুন:" : "Quick add:"}</div>
            <div className="flex flex-wrap gap-1.5">
              {missingPresets.map((p) => {
                const name = bn ? p.bn : p.en;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => addMut.mutate({ name, type })}
                    className="text-xs px-2 py-1 rounded-md border border-dashed hover:bg-muted"
                  >
                    + {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
          {existing.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {bn ? "কোন ক্যাটাগরি নেই" : "No categories yet"}
            </p>
          )}
          {existing.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-md border p-2">
              {editingId === c.id ? (
                <>
                  <Input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); renameMut.mutate({ id: c.id, name: editingName }); }
                      else if (e.key === "Escape") { setEditingId(null); }
                    }}
                  />
                  <Button size="sm" variant="outline" disabled={!editingName.trim() || renameMut.isPending}
                    onClick={() => renameMut.mutate({ id: c.id, name: editingName })}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{c.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(c.id); setEditingName(c.name); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                    disabled={deleteMut.isPending}
                    onClick={() => { if (confirm(`${c.name} — ${t("delete")}?`)) deleteMut.mutate(c.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{bn ? "ক্যাটাগরি ম্যানেজমেন্ট" : "Manage categories"}</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="income">{bn ? "জমা" : "Income"}</TabsTrigger>
            <TabsTrigger value="expense">{bn ? "খরচ" : "Expense"}</TabsTrigger>
          </TabsList>
          <TabsContent value="income" className="mt-4">{list("income")}</TabsContent>
          <TabsContent value="expense" className="mt-4">{list("expense")}</TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("close") || t("cancel")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
