import { Building2, Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentBranch } from "@/lib/current-branch";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function BranchSwitcher({ compact = false }: { compact?: boolean }) {
  const { branches, currentBranch, setBranch, isLoading } = useCurrentBranch();
  const [open, setOpen] = useState(false);

  if (isLoading) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background hover:bg-accent transition-colors",
            compact ? "px-2 py-1.5 text-xs" : "px-3 py-1.5 text-sm font-medium",
          )}
          title="Branch"
        >
          <Building2 className="h-4 w-4 text-violet-600" />
          <span className="truncate max-w-[120px]">
            {currentBranch?.name ?? "Select Branch"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Branches
        </div>
        <div className="max-h-72 overflow-y-auto">
          {branches.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground">No branches yet.</div>
          )}
          {branches.map((b) => {
            const active = b.id === currentBranch?.id;
            return (
              <button
                key={b.id}
                onClick={() => {
                  setBranch(b.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left",
                  active && "bg-accent",
                )}
              >
                <Building2 className="h-4 w-4 text-violet-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{b.name}</div>
                  {b.code && (
                    <div className="text-[11px] text-muted-foreground truncate">{b.code}</div>
                  )}
                </div>
                {b.is_main && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                    MAIN
                  </span>
                )}
                {active && <Check className="h-4 w-4 text-emerald-600" />}
              </button>
            );
          })}
        </div>
        <div className="border-t border-border/60 mt-1 pt-1">
          <Link
            to="/branches"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-primary hover:bg-accent rounded-md"
          >
            Manage branches →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
