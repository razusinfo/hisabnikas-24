import appLogo from "@/assets/logo.png.asset.json";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Receipt,
  ShoppingCart,
  Package,
  Users,
  LogOut,
  Sparkles,
  Wallet,
  Settings,
  HelpCircle,
  MessageSquare,
  Menu,
  ShieldCheck,
  TrendingUp,
  Database,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SearchProvider, SearchTrigger, SearchIconButton } from "@/components/GlobalSearch";
import { useAutoBackup } from "@/lib/auto-backup";

function LangToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  const base =
    "rounded-md text-xs font-semibold transition-colors " +
    (compact ? "px-2 py-1.5 h-8" : "px-3 py-2 h-9");
  return (
    <div className={cn("inline-flex items-center gap-1", compact ? "" : "w-full")}>
      <button
        onClick={() => setLang("en")}
        className={cn(
          base,
          lang === "en"
            ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/20"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        )}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
      <button
        onClick={() => setLang("bn")}
        className={cn(
          base,
          lang === "bn"
            ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/20"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        )}
        aria-pressed={lang === "bn"}
      >
        বাং
      </button>
    </div>
  );
}
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const colorStyles: Record<string, { activeBg: string; activeText: string; activeRing: string; inactiveText: string; inactiveHoverText: string; inactiveHoverBg: string; dot: string }> = {
  blue: { activeBg: "bg-sky-100", activeText: "text-sky-700", activeRing: "ring-sky-200", inactiveText: "text-sky-500", inactiveHoverText: "hover:text-sky-700", inactiveHoverBg: "hover:bg-sky-50", dot: "bg-sky-500" },
  emerald: { activeBg: "bg-emerald-100", activeText: "text-emerald-700", activeRing: "ring-emerald-200", inactiveText: "text-emerald-500", inactiveHoverText: "hover:text-emerald-700", inactiveHoverBg: "hover:bg-emerald-50", dot: "bg-emerald-500" },
  amber: { activeBg: "bg-amber-100", activeText: "text-amber-700", activeRing: "ring-amber-200", inactiveText: "text-amber-500", inactiveHoverText: "hover:text-amber-700", inactiveHoverBg: "hover:bg-amber-50", dot: "bg-amber-500" },
  violet: { activeBg: "bg-violet-100", activeText: "text-violet-700", activeRing: "ring-violet-200", inactiveText: "text-violet-500", inactiveHoverText: "hover:text-violet-700", inactiveHoverBg: "hover:bg-violet-50", dot: "bg-violet-500" },
  rose: { activeBg: "bg-rose-100", activeText: "text-rose-700", activeRing: "ring-rose-200", inactiveText: "text-rose-500", inactiveHoverText: "hover:text-rose-700", inactiveHoverBg: "hover:bg-rose-50", dot: "bg-rose-500" },
  cyan: { activeBg: "bg-cyan-100", activeText: "text-cyan-700", activeRing: "ring-cyan-200", inactiveText: "text-cyan-500", inactiveHoverText: "hover:text-cyan-700", inactiveHoverBg: "hover:bg-cyan-50", dot: "bg-cyan-500" },
  slate: { activeBg: "bg-slate-100", activeText: "text-slate-700", activeRing: "ring-slate-200", inactiveText: "text-slate-500", inactiveHoverText: "hover:text-slate-700", inactiveHoverBg: "hover:bg-slate-50", dot: "bg-slate-500" },
  teal: { activeBg: "bg-teal-100", activeText: "text-teal-700", activeRing: "ring-teal-200", inactiveText: "text-teal-500", inactiveHoverText: "hover:text-teal-700", inactiveHoverBg: "hover:bg-teal-50", dot: "bg-teal-500" },
  orange: { activeBg: "bg-orange-100", activeText: "text-orange-700", activeRing: "ring-orange-200", inactiveText: "text-orange-500", inactiveHoverText: "hover:text-orange-700", inactiveHoverBg: "hover:bg-orange-50", dot: "bg-orange-500" },
  indigo: { activeBg: "bg-indigo-100", activeText: "text-indigo-700", activeRing: "ring-indigo-200", inactiveText: "text-indigo-500", inactiveHoverText: "hover:text-indigo-700", inactiveHoverBg: "hover:bg-indigo-50", dot: "bg-indigo-500" },
  red: { activeBg: "bg-red-100", activeText: "text-red-700", activeRing: "ring-red-200", inactiveText: "text-red-500", inactiveHoverText: "hover:text-red-700", inactiveHoverBg: "hover:bg-red-50", dot: "bg-red-500" },
};

const nav = [
  { to: "/dashboard", icon: LayoutDashboard, key: "dashboard" as const, color: "blue" },
  { to: "/sales", icon: Receipt, key: "sales" as const, color: "emerald" },
  { to: "/purchases", icon: ShoppingCart, key: "purchases" as const, color: "amber" },
  { to: "/products", icon: Package, key: "products" as const, color: "violet" },
  { to: "/expenses", icon: Wallet, key: "expenses" as const, color: "rose" },
  { to: "/customers", icon: Users, key: "customers" as const, color: "cyan" },
  { to: "/profit-loss", icon: TrendingUp, key: "profitLoss" as const, color: "teal" },
];

const footerNav = [
  { to: "/settings", icon: Settings, key: "settings" as const, color: "slate" },
  { to: "/backup-restore", icon: Database, key: "backupRestore" as const, color: "slate" },
  { to: "/buy-messages", icon: MessageSquare, key: "buyMessages" as const, color: "teal" },
  { to: "/help", icon: HelpCircle, key: "helpSupport" as const, color: "orange" },
  { to: "/current-package", icon: Sparkles, key: "currentPackage" as const, color: "indigo" },
];

function SidebarContent({
  onNavigate,
  onSignOut,
  brandName,
  brandLogo,
  searchSlot,
}: {
  onNavigate?: () => void;
  onSignOut: () => void;
  brandName: string;
  brandLogo: string | null | undefined;
  searchSlot?: ReactNode;
}) {
  const { t } = useI18n();
  const loc = useLocation();
  const isActive = (to: string) => loc.pathname === to || loc.pathname.startsWith(to + "/");

  const superAdminQ = useQuery({
    queryKey: ["is-super-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase
        .from("profiles")
        .select("is_super_admin")
        .eq("id", u.user.id)
        .maybeSingle();
      return !!(data as any)?.is_super_admin;
    },
  });
  const effectiveFooter = superAdminQ.data
    ? [
        ...footerNav,
        { to: "/admin-payments", icon: ShieldCheck, key: "adminPayments" as const, color: "red" },
      ]
    : footerNav;

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-5">
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center">
          <img src={appLogo.url} alt="হিসাব নিকাশ-২৪" className="h-28 w-auto" />
        </Link>
      </div>
      {searchSlot}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          const cs = colorStyles[item.color] ?? colorStyles.blue;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all",
                active
                  ? `${cs.activeBg} ${cs.activeText} ring-1 ${cs.activeRing}`
                  : `${cs.inactiveText} ${cs.inactiveHoverText} ${cs.inactiveHoverBg}`,
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active ? cs.activeText : "")} />
              <span className="truncate">{t(item.key)}</span>
              {active && <span className={cn("ml-auto h-2 w-2 rounded-full shrink-0", cs.dot)} />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border space-y-1.5">
        {effectiveFooter.map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          const cs = colorStyles[(item as any).color ?? "slate"];
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all",
                active
                  ? `${cs.activeBg} ${cs.activeText} ring-1 ${cs.activeRing}`
                  : `${cs.inactiveText} ${cs.inactiveHoverText} ${cs.inactiveHoverBg}`,
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active ? cs.activeText : "")} />
              <span className="truncate">{t(item.key)}</span>
              {active && <span className={cn("ml-auto h-2 w-2 rounded-full shrink-0", cs.dot)} />}
            </Link>
          );
        })}
        <button
          onClick={() => {
            onNavigate?.();
            onSignOut();
          }}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-[15px] font-medium text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="truncate">{t("signOut")}</span>
        </button>
        <div className="px-3 pt-1 pb-0.5 text-center">
          <span className="text-[10px] text-muted-foreground tracking-wide">
            {t("appName")} <span className="opacity-60">|</span> {t("version")}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  useAutoBackup();

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const brandQuery = useQuery({
    queryKey: ["app-brand"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { name: null as string | null, logoUrl: null as string | null };
      const { data: p } = await supabase
        .from("profiles")
        .select("company_name, logo_url")
        .eq("id", u.user.id)
        .maybeSingle();
      let logoUrl: string | null = null;
      if (p?.logo_url) {
        const { data: signed } = await supabase.storage
          .from("business-logos")
          .createSignedUrl(p.logo_url, 60 * 60);
        logoUrl = signed?.signedUrl ?? null;
      }
      return { name: p?.company_name ?? null, logoUrl };
    },
  });

  const brandName = brandQuery.data?.name || t("appName");
  const brandLogo = brandQuery.data?.logoUrl;

  return (
    <SearchProvider>
      <div className="min-h-screen flex bg-background text-foreground">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-72 shrink-0 bg-sidebar border-r border-sidebar-border flex-col">
          <SidebarContent
            onSignOut={handleSignOut}
            brandName={brandName}
            brandLogo={brandLogo}
            searchSlot={
              <div className="px-6 pb-3 space-y-2">
                <SearchTrigger className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 bg-sidebar-accent/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors" />
                <LangToggle />
              </div>
            }
          />
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Mobile top bar */}
          <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-sidebar/95 backdrop-blur border-b border-sidebar-border">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu" className="min-h-11 min-w-11">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 bg-sidebar">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <SidebarContent
                  onNavigate={() => setMobileOpen(false)}
                  onSignOut={handleSignOut}
                  brandName={brandName}
                  brandLogo={brandLogo}
                />
              </SheetContent>
            </Sheet>
            <Link to="/dashboard" className="flex items-center min-w-0">
              <img src={appLogo.url} alt="হিসাব নিকাশ-২৪" className="h-20 w-auto" />
            </Link>
            <div className="flex-1" />
            <LangToggle compact />
            <SearchIconButton className="min-h-11 min-w-11" />
          </header>

          <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
          <footer className="px-4 py-3 text-center text-[11px] text-muted-foreground border-t border-border/40">
            প্রস্তুতকারক: www.sylhetionlineshop.com
          </footer>
        </div>
      </div>
    </SearchProvider>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 mb-6 sm:mb-8 sm:flex sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 justify-end">{actions}</div>}
    </div>
  );
}
