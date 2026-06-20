import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { setCurrentBranchId } from "@/lib/current-branch";

export const Route = createFileRoute("/_authenticated/branches")({
  component: BranchesPage,
});

type BranchRow = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  is_main: boolean;
  is_active: boolean;
};

type FormState = {
  id?: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  is_main: boolean;
  is_active: boolean;
};

const empty: FormState = {
  name: "",
  code: "",
  address: "",
  phone: "",
  is_main: false,
  is_active: true,
};

function BranchesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);

  const branchesQ = useQuery({
    queryKey: ["branches", "manage"],
    queryFn: async (): Promise<BranchRow[]> => {
      const { data, error } = await supabase
        .from("branches" as any)
        .select("id,name,code,address,phone,is_main,is_active")
        .is("deleted_at", null)
        .order("is_main", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BranchRow[];
    },
  });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload: any = {
        name: f.name.trim(),
        code: f.code.trim() || null,
        address: f.address.trim() || null,
        phone: f.phone.trim() || null,
        is_main: f.is_main,
        is_active: f.is_active,
      };
      if (f.id) {
        const { error } = await supabase
          .from("branches" as any)
          .update(payload)
          .eq("id", f.id);
        if (error) throw error;
      } else {
        payload.owner_id = u.user.id;
        const { error } = await supabase.from("branches" as any).insert(payload);
        if (error) throw error;
      }
      // Ensure only one main branch
      if (f.is_main) {
        await supabase
          .from("branches" as any)
          .update({ is_main: false })
          .neq("id", f.id ?? "00000000-0000-0000-0000-000000000000")
          .eq("owner_id", u.user.id);
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Branch updated" : "Branch created");
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["branches", "manage"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const removeM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("branches" as any)
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Branch deactivated");
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["branches", "manage"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const startEdit = (b: BranchRow) => {
    setForm({
      id: b.id,
      name: b.name,
      code: b.code ?? "",
      address: b.address ?? "",
      phone: b.phone ?? "",
      is_main: b.is_main,
      is_active: b.is_active,
    });
    setOpen(true);
  };

  const handleDelete = (b: BranchRow) => {
    if (b.is_main) {
      toast.error("Cannot delete the main branch");
      return;
    }
    if (!confirm(`Deactivate branch "${b.name}"?`)) return;
    removeM.mutate(b.id);
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <PageHeader
          title="Branches"
          subtitle="Manage your branches / outlets"
          actions={
            <Dialog
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (!o) setForm(empty);
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-1" />
                  New Branch
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{form.id ? "Edit Branch" : "New Branch"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid gap-1.5">
                    <Label>Name *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Dhaka Branch"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Code</Label>
                      <Input
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                        placeholder="DHK"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Phone</Label>
                      <Input
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Address</Label>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">Main branch</div>
                      <div className="text-xs text-muted-foreground">
                        Used as default for new entries.
                      </div>
                    </div>
                    <Switch
                      checked={form.is_main}
                      onCheckedChange={(v) => setForm({ ...form, is_main: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">Active</div>
                      <div className="text-xs text-muted-foreground">
                        Inactive branches are hidden from the switcher.
                      </div>
                    </div>
                    <Switch
                      checked={form.is_active}
                      onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      setForm(empty);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!form.name.trim()) {
                        toast.error("Name required");
                        return;
                      }
                      save.mutate(form);
                    }}
                    disabled={save.isPending}
                  >
                    {save.isPending ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />

        <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branchesQ.isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {!branchesQ.isLoading && (branchesQ.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No branches yet.
                  </TableCell>
                </TableRow>
              )}
              {(branchesQ.data ?? []).map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-violet-600" />
                      <span className="font-medium">{b.name}</span>
                      {b.is_main && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                          MAIN
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{b.code ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{b.phone ?? "—"}</TableCell>
                  <TableCell>
                    <span
                      className={
                        b.is_active
                          ? "text-emerald-700 text-xs px-2 py-0.5 rounded-full bg-emerald-100"
                          : "text-muted-foreground text-xs px-2 py-0.5 rounded-full bg-muted"
                      }
                    >
                      {b.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCurrentBranchId(b.id);
                        toast.success(`Switched to ${b.name}`);
                      }}
                    >
                      Switch
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(b)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(b)}
                      disabled={b.is_main}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
