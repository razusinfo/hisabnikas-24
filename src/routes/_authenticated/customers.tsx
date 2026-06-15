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
import { Plus, Search, Trash2, Wallet, MessageSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/customers")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: ["customers"], queryFn: fetchCustomers });
  },
  component: CustomersPage,
});

export async function fetchCustomers() {
  const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

function CustomersPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: ["customers"], queryFn: fetchCustomers });
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [collectFor, setCollectFor] = useState<{ id: string; name: string; due: number } | null>(null);
  const [collectAmount, setCollectAmount] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("customers").insert({ ...form, owner_id: u.user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer added");
      setOpen(false);
      setForm({ name: "", phone: "", email: "", address: "" });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const collect = useMutation({
    mutationFn: async () => {
      if (!collectFor) throw new Error("No customer");
      const amount = Number(collectAmount);
      if (!amount || amount <= 0) throw new Error("Invalid amount");
      if (amount > collectFor.due) throw new Error("পরিমাণ বাকির চেয়ে বেশি");
      const newDue = collectFor.due - amount;
      const { error } = await supabase.from("customers").update({ due_balance: newDue }).eq("id", collectFor.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("পরিশোধ রেকর্ড হয়েছে");
      setCollectFor(null);
      setCollectAmount("");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const filtered = data.filter((c) =>
    [c.name, c.phone, c.email].some((v) => v?.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t("customers")}
        subtitle="Track who buys, what they owe, and when they paid."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> {t("addCustomer")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("addCustomer")}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
                <div className="space-y-1.5"><Label>{t("name")}</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>{t("email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5"><Label>{t("address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
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

      {/* Desktop table */}
      <div className="card-premium overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
              <tr className="text-left">
                <th className="py-3 px-4">{t("name")}</th>
                <th className="py-3 px-4">{t("phone")}</th>
                <th className="py-3 px-4">{t("email")}</th>
                <th className="py-3 px-4 text-right">{t("due")}</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">{t("noData")}</td></tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-border/40 hover:bg-muted/30">
                  <td className="py-3 px-4 font-medium">{c.name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{c.phone || "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground">{c.email || "—"}</td>
                  <td className="py-3 px-4 text-right font-mono">{Number(c.due_balance) > 0 ? <span className="text-warning">{fmtMoney(c.due_balance)}</span> : "—"}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-1">
                      {Number(c.due_balance) > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setCollectFor({ id: c.id, name: c.name, due: Number(c.due_balance) }); setCollectAmount(""); }}
                        >
                          <Wallet className="h-4 w-4" /> {"বাকি আদায়"}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(c.id)} aria-label={t("delete") || "Delete"}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="card-premium p-8 text-center text-muted-foreground text-sm">{t("noData")}</div>
        )}
        {filtered.map((c) => (
          <div key={c.id} className="card-premium p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                {c.phone && <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.phone}</div>}
                {c.email && <div className="text-xs text-muted-foreground truncate">{c.email}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("due")}</div>
                <div className={`font-mono text-sm ${Number(c.due_balance) > 0 ? "text-warning" : ""}`}>
                  {Number(c.due_balance) > 0 ? fmtMoney(c.due_balance) : "—"}
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t">
              {Number(c.due_balance) > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11 flex-1"
                  onClick={() => { setCollectFor({ id: c.id, name: c.name, due: Number(c.due_balance) }); setCollectAmount(""); }}
                >
                  <Wallet className="h-4 w-4 mr-1" /> {"বাকি আদায়"}
                </Button>
              )}
              <Button size="sm" variant="ghost" className="min-h-11" onClick={() => del.mutate(c.id)} aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>


      <Dialog open={!!collectFor} onOpenChange={(o) => !o && setCollectFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{"বাকি আদায়"} — {collectFor?.name}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); collect.mutate(); }} className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {t("due")}: <span className="font-mono text-warning">{fmtMoney(collectFor?.due ?? 0)}</span>
            </div>
            <div className="space-y-1.5">
              <Label>{"পরিমাণ"}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={collectFor?.due}
                required
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
                autoFocus
              />
            </div>
            <Button disabled={collect.isPending} className="w-full">{t("save")}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
