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
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SearchProvider, SearchTrigger, SearchIconButton } from "@/components/GlobalSearch";

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

const nav = [
  { to: "/dashboard", icon: LayoutDashboard, key: "dashboard" as const, color: "blue" },
  { to: "/sales", icon: Receipt, key: "sales" as const, color: "green" },
  { to: "/purchases", icon: ShoppingCart, key: "purchases" as const, color: "purple" },
  { to: "/products", icon: Package, key: "products" as const, color: "amber" },
  { to: "/expenses", icon: Wallet, key: "expenses" as const, color: "rose" },
  { to: "/customers", icon: Users, key: "customers" as const, color: "teal" },
];

const footerNav = [
  { to: "/settings", icon: Settings, key: "settings" as const, color: "indigo" },
  { to: "/buy-messages", icon: MessageSquare, key: "buyMessages" as const, color: "blue" },
  { to: "/help", icon: HelpCircle, key: "helpSupport" as const, color: "teal" },
  { to: "/current-package", icon: Sparkles, key: "currentPackage" as const, color: "amber" },
];

const colorClass: Record<string, string> = {
  blue: "bg-card-blue text-card-blue-fg hover:bg-card-blue/80",
  green: "bg-card-green text-card-green-fg hover:bg-card-green/80",
  purple: "bg-card-purple text-card-purple-fg hover:bg-card-purple/80",
  amber: "bg-card-amber text-card-amber-fg hover:bg-card-amber/80",
  rose: "bg-card-rose text-card-rose-fg hover:bg-card-rose/80",
  teal: "bg-card-teal text-card-teal-fg hover:bg-card-teal/80",
  indigo: "bg-card-indigo text-card-indigo-fg hover:bg-card-indigo/80",
};

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
        { to: "/admin-payments", icon: ShieldCheck, key: "adminPayments" as const, color: "purple" },
      ]
    : footerNav;

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-6">
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center bg-primary/15 ring-1 ring-primary/30 overflow-hidden">
            {brandLogo ? (
              <img src={brandLogo} alt="logo" className="h-full w-full object-cover" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-display text-base font-semibold tracking-tight truncate">{brandName}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{t("tagline")}</div>
          </div>
        </Link>
      </div>
      {searchSlot}
      <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
        {nav.map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                colorClass[item.color],
                active && "ring-2 ring-primary/40 shadow-sm",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(item.key)}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current shrink-0" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        {effectiveFooter.map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/20"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "")} />
              <span className="truncate">{t(item.key)}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
            </Link>
          );
        })}
        <button
          onClick={() => {
            onNavigate?.();
            onSignOut();
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4 shrink-0" />
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
        <aside className="hidden md:flex w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex-col">
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
            <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center bg-primary/15 ring-1 ring-primary/30 overflow-hidden">
                {brandLogo ? (
                  <img src={brandLogo} alt="logo" className="h-full w-full object-cover" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
              </div>
              <span className="font-display text-sm font-semibold tracking-tight truncate">{brandName}</span>
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
