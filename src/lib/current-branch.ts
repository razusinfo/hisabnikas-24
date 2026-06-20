import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "current_branch_id";
const EVENT = "current-branch-changed";

export function getCurrentBranchId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setCurrentBranchId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export type Branch = {
  id: string;
  name: string;
  code: string | null;
  is_main: boolean;
  is_active: boolean;
};

export function useBranches() {
  return useQuery({
    queryKey: ["branches"],
    queryFn: async (): Promise<Branch[]> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("branches" as any)
        .select("id,name,code,is_main,is_active")
        .is("deleted_at", null)
        .order("is_main", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Branch[];
    },
  });
}

export function useCurrentBranch() {
  const branchesQ = useBranches();
  const [current, setCurrent] = useState<string | null>(() => getCurrentBranchId());

  useEffect(() => {
    const onChange = () => setCurrent(getCurrentBranchId());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  // Auto-select main branch if none selected
  useEffect(() => {
    if (current) return;
    const list = branchesQ.data;
    if (!list || list.length === 0) return;
    const main = list.find((b) => b.is_main) ?? list[0];
    if (main) setCurrentBranchId(main.id);
  }, [branchesQ.data, current]);

  const setBranch = useCallback((id: string | null) => setCurrentBranchId(id), []);

  return {
    branches: branchesQ.data ?? [],
    isLoading: branchesQ.isLoading,
    currentBranchId: current,
    currentBranch: (branchesQ.data ?? []).find((b) => b.id === current) ?? null,
    setBranch,
  };
}

/** Resolve branch_id for an insert: selected one, else first available. Returns null if none exist. */
export async function resolveBranchIdForInsert(): Promise<string | null> {
  const fromStorage = getCurrentBranchId();
  if (fromStorage) return fromStorage;
  const { data } = await supabase
    .from("branches" as any)
    .select("id,is_main")
    .is("deleted_at", null)
    .order("is_main", { ascending: false })
    .limit(1);
  const id = (data?.[0] as any)?.id ?? null;
  if (id) setCurrentBranchId(id);
  return id;
}
