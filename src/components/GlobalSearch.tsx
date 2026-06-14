"use client";

import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Package, Users, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type SearchItem = {
  type: "product" | "customer" | "sale";
  id: string;
  title: string;
  to: string;
};

const Ctx = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Ctx.Provider value={{ open, setOpen }}>
      {children}
      <SearchDialog />
    </Ctx.Provider>
  );
}

function SearchDialog() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { open, setOpen } = useContext(Ctx);

  const { data } = useQuery({
    queryKey: ["global-search"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as SearchItem[];
      const [{ data: products }, { data: customers }, { data: sales }] = await Promise.all([
        supabase.from("products").select("id,name").order("name").limit(30),
        supabase.from("customers").select("id,name").order("name").limit(30),
        supabase.from("sales").select("id,invoice_no").order("created_at", { ascending: false }).limit(20),
      ]);
      return [
        ...(products ?? []).map((p) => ({ type: "product" as const, id: p.id, title: p.name, to: "/products" })),
        ...(customers ?? []).map((c) => ({ type: "customer" as const, id: c.id, title: c.name, to: "/customers" })),
        ...(sales ?? []).map((s) => ({ type: "sale" as const, id: s.id, title: s.invoice_no, to: "/sales" })),
      ] as SearchItem[];
    },
    enabled: open,
  });

  const onSelect = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  const products = data?.filter((i) => i.type === "product") ?? [];
  const customers = data?.filter((i) => i.type === "customer") ?? [];
  const sales = data?.filter((i) => i.type === "sale") ?? [];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("search")} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {products.length > 0 && (
          <CommandGroup heading={t("products")}>
            {products.map((item) => (
              <CommandItem key={item.id} value={item.title} onSelect={() => onSelect(item.to)}>
                <Package className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {customers.length > 0 && (
          <CommandGroup heading={t("customers")}>
            {customers.map((item) => (
              <CommandItem key={item.id} value={item.title} onSelect={() => onSelect(item.to)}>
                <Users className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {sales.length > 0 && (
          <CommandGroup heading={t("sales")}>
            {sales.map((item) => (
              <CommandItem key={item.id} value={item.title} onSelect={() => onSelect(item.to)}>
                <Receipt className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function SearchTrigger({ className }: { className?: string }) {
  const { t } = useI18n();
  const { setOpen } = useContext(Ctx);
  return (
    <button onClick={() => setOpen(true)} className={className} aria-label={t("search")}>
      <Search className="h-4 w-4 shrink-0" />
      <span className="truncate">{t("search")}</span>
      <kbd className="ml-auto hidden lg:inline-flex h-5 items-center gap-1 rounded border bg-sidebar px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}

export function SearchIconButton({ className }: { className?: string }) {
  const { setOpen } = useContext(Ctx);
  return (
    <button
      onClick={() => setOpen(true)}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      aria-label="Search"
    >
      <Search className="h-5 w-5" />
    </button>
  );
}
