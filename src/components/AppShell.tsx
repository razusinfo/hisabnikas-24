import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Receipt,
  ShoppingCart,
  Package,
  Users,
  LogOut,
  Languages,
  Sparkles,
  Wallet,
  Settings,
  HelpCircle,
  MessageSquare,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", icon: LayoutDashboard, key: "dashboard" as const },
  { to: "/sales", icon: Receipt, key: "sales" as const },
  { to: "/purchases", icon: ShoppingCart, key: "purchases" as const },
  { to: "/products", icon: Package, key: "products" as const },
  { to: "/expenses", icon: Wallet, key: "expenses" as const },
  { to: "/customers", icon: Users, key: "customers" as const },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const loc = useLocation();

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="px-6 py-6">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary/15 ring-1 ring-primary/30">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-base font-semibold tracking-tight">{t("appName")}</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{t("tagline")}</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {nav.map((item) => {
            const active = loc.pathname === item.to || loc.pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/20"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-primary" : "")} />
                <span>{t(item.key)}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
          <Link
            to="/settings"
            className={cn(
              "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
              loc.pathname === "/settings" || loc.pathname.startsWith("/settings/")
                ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/20"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
            )}
          >
            <Settings className={cn("h-4 w-4", loc.pathname === "/settings" || loc.pathname.startsWith("/settings/") ? "text-primary" : "")} />
            <span>{t("settings")}</span>
            {(loc.pathname === "/settings" || loc.pathname.startsWith("/settings/")) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
          </Link>
          <Link
            to="/buy-messages"
            className={cn(
              "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
              loc.pathname === "/buy-messages" || loc.pathname.startsWith("/buy-messages/")
                ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/20"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
            )}
          >
            <MessageSquare className={cn("h-4 w-4", loc.pathname === "/buy-messages" || loc.pathname.startsWith("/buy-messages/") ? "text-primary" : "")} />
            <span>{t("buyMessages")}</span>
            {(loc.pathname === "/buy-messages" || loc.pathname.startsWith("/buy-messages/")) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
          </Link>
          <Link
            to="/help"
            className={cn(
              "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
              loc.pathname === "/help" || loc.pathname.startsWith("/help/")
                ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/20"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
            )}
          >
            <HelpCircle className={cn("h-4 w-4", loc.pathname === "/help" || loc.pathname.startsWith("/help/") ? "text-primary" : "")} />
            <span>{t("helpSupport")}</span>
            {(loc.pathname === "/help" || loc.pathname.startsWith("/help/")) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
          </Link>
          <button
            onClick={() => setLang(lang === "en" ? "bn" : "en")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
          >
            <Languages className="h-4 w-4" />
            <span>{lang === "en" ? "বাংলা" : "English"}</span>
            <span className="ml-auto text-[10px] uppercase tracking-wider opacity-60">
              {lang === "en" ? "BN" : "EN"}
            </span>
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            <span>{t("signOut")}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
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
    <div className="flex items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
