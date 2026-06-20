import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  Wallet,
  Receipt,
  ArrowRight,
  Smartphone,
  Landmark,
  PieChart,
  Boxes,
  Repeat,
  Tags,
  Layers,
  CreditCard,
  FileText,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/")({
  component: ReportsIndexPage,
});

// Free for everyone; others unlocked for users with an active paid package.
const FREE_SLUGS = new Set(["purchase", "sales", "expenses", "stock-summary"]);

const reportCards = [
  { slug: "purchase", title: "ক্রয় রিপোর্ট", titleEn: "Purchase Report", description: "সরবরাহকারী ও তারিখ অনুযায়ী ক্রয়ের বিবরণ।", icon: ShoppingCart, color: "text-amber-600", bg: "bg-amber-50" },
  { slug: "sales", title: "বিক্রয় রিপোর্ট", titleEn: "Sales Report", description: "দৈনিক, সাপ্তাহিক ও মাসিক বিক্রয়ের সংক্ষিপ্ত বিবরণ।", icon: Receipt, color: "text-emerald-600", bg: "bg-emerald-50" },
  { slug: "products", title: "পণ্যের রিপোর্ট", titleEn: "Products Report", description: "স্টক, ক্যাটাগরি ও মূল্য অনুযায়ী পণ্যের তালিকা।", icon: Package, color: "text-violet-600", bg: "bg-violet-50" },
  { slug: "customers", title: "কাস্টমার রিপোর্ট", titleEn: "Customer Report", description: "ক্রেতাদের বাকি, বিক্রয় ও পরিশোধের বিবরণ।", icon: Users, color: "text-cyan-600", bg: "bg-cyan-50" },
  { slug: "dues", title: "বাকির রিপোর্ট", titleEn: "Due Report", description: "পরিশোধযোগ্য ও আদায়যোগ্য বাকির বিস্তারিত তালিকা।", icon: Wallet, color: "text-rose-600", bg: "bg-rose-50" },
  { slug: "sales-profit", title: "বিক্রয় অনুযায়ী লাভ ক্ষতি", titleEn: "Sales-wise Profit & Loss", description: "প্রতিটি বিক্রয় অনুযায়ী লাভ ও ক্ষতির বিশ্লেষণ।", icon: PieChart, color: "text-green-600", bg: "bg-green-50" },
  { slug: "profit-loss", title: "লাভ ক্ষতি", titleEn: "Profit & Loss", description: "বিক্রয়, ক্রয় ও খরচের ভিত্তিকে লাভ-ক্ষতির বিস্তারিত বিবরণ।", icon: TrendingUp, color: "text-teal-600", bg: "bg-teal-50" },
  { slug: "mobile-banking", title: "মোবাইল ব্যাংকিং রিপোর্ট", titleEn: "Mobile Banking Report", description: "বিকাশ, নগদ, রকেট ইত্যাদি মোবাইল ব্যাংকিং লেনদেনের বিবরণ।", icon: Smartphone, color: "text-pink-600", bg: "bg-pink-50" },
  { slug: "unmatched-payments", title: "Unmatched Payments", titleEn: "Unmatched Payments", description: "যেসব SMS payment এখনও invoice এর সাথে match হয়নি — manually match করুন।", icon: Smartphone, color: "text-rose-600", bg: "bg-rose-50" },
  { slug: "bank", title: "ব্যাংক লেনদেন রিপোর্ট", titleEn: "Bank Transaction Report", description: "ব্যাংক অ্যাকাউন্টের জমা ও উত্তোলনের সম্পূর্ণ বিবরণ।", icon: Landmark, color: "text-blue-600", bg: "bg-blue-50" },
  { slug: "expenses", title: "খরচ", titleEn: "Expenses", description: "সকল খরচের বিস্তারিত বিবরণ ও বিশ্লেষণ।", icon: CreditCard, color: "text-red-600", bg: "bg-red-50" },
  { slug: "expense-type", title: "খরচের ধরন", titleEn: "Expense Type", description: "ধরন অনুযায়ী খরচের বিস্তারিত বিশ্লেষণ।", icon: Layers, color: "text-yellow-600", bg: "bg-yellow-50" },
  { slug: "expense-category", title: "খরচের ক্যাটাগরি", titleEn: "Expense Category", description: "ক্যাটাগরি অনুযায়ী খরচের সংক্ষিপ্ত বিবরণ।", icon: Tags, color: "text-fuchsia-600", bg: "bg-fuchsia-50" },
  { slug: "stock-summary", title: "স্টক সামারী", titleEn: "Stock Summary", description: "বর্তমান স্টকের সংক্ষিপ্ত বিবরণ ও মূল্যমান।", icon: Boxes, color: "text-indigo-600", bg: "bg-indigo-50" },
  { slug: "stock-movement", title: "স্টক পরিবর্তনের রিপোর্ট", titleEn: "Stock Movement Report", description: "পণ্যের স্টক বৃদ্ধি ও হ্রাসের বিস্তারিত বিবরণ।", icon: Repeat, color: "text-orange-600", bg: "bg-orange-50" },
  { slug: "item-detail", title: "আইটেমের বিস্তারিত রিপোর্ট", titleEn: "Item Detail Report", description: "প্রতিটি আইটেমের বিস্তারিত তথ্য ও লেনদেনের বিবরণ।", icon: FileText, color: "text-slate-600", bg: "bg-slate-50" },
];

function ReportsIndexPage() {
  const { t, lang } = useI18n();
  const bn = lang === "bn";
  const [lockedOpen, setLockedOpen] = useState(false);
  const [lockedTitle, setLockedTitle] = useState("");

  const subQuery = useQuery({
    queryKey: ["my-subscription"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return null;
      const { data } = await supabase
        .from("subscriptions")
        .select("plan,status,expires_at")
        .eq("user_id", uid)
        .maybeSingle();
      return data;
    },
  });

  const isPackageActive = (() => {
    const s = subQuery.data;
    if (!s) return false;
    if (s.status !== "active") return false;
    if (s.plan === "trial" || s.plan === "free") return false;
    if (!s.expires_at) return false;
    return new Date(s.expires_at).getTime() > Date.now();
  })();


  const cardInner = (card: (typeof reportCards)[number], locked: boolean) => {
    const Icon = card.icon;
    return (
      <Card className="border-0 shadow-none bg-transparent relative overflow-hidden">
        {locked && (
          <div className="absolute top-0 right-0 z-10 pointer-events-none">
            <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-bold py-1 w-32 text-center shadow-md rotate-45 translate-x-8 translate-y-3">
              {bn ? "প্যাকেজ" : "PACKAGE"}
            </div>
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className={`h-10 w-10 rounded-xl ${card.bg} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${card.color}`} />
            </div>
            {locked ? (
              <Lock className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            )}
          </div>
          <CardTitle className="text-base mt-3">
            {bn ? card.title : card.titleEn}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {card.description}
          </p>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader title={t("reports")} subtitle={bn ? "সব রিপোর্ট এক জায়গায়" : "All reports in one place"} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCards.map((card) => {
          const isFree = FREE_SLUGS.has(card.slug) || isPackageActive;
          if (isFree) {
            if (card.slug === "mobile-banking" || card.slug === "unmatched-payments") {
              return (
                <Link
                  key={card.slug}
                  to={card.slug === "mobile-banking" ? "/mobile-banking" : "/unmatched-payments"}
                  className="group block rounded-2xl border border-border bg-card hover:shadow-md transition-all hover:border-primary/30"
                >
                  {cardInner(card, false)}
                </Link>
              );
            }
            return (
              <Link
                key={card.slug}
                to="/reports/$slug"
                params={{ slug: card.slug }}
                className="group block rounded-2xl border border-border bg-card hover:shadow-md transition-all hover:border-primary/30"
              >
                {cardInner(card, false)}
              </Link>
            );
          }
          return (
            <button
              key={card.slug}
              type="button"
              onClick={() => {
                setLockedTitle(bn ? card.title : card.titleEn);
                setLockedOpen(true);
              }}
              className="group block text-left rounded-2xl border border-border bg-card hover:shadow-md transition-all hover:border-primary/30"
            >
              {cardInner(card, true)}
            </button>
          );
        })}
      </div>

      <Dialog open={lockedOpen} onOpenChange={setLockedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 h-14 w-14 rounded-full bg-amber-50 flex items-center justify-center">
              <Lock className="h-7 w-7 text-amber-600" />
            </div>
            <DialogTitle className="text-center">
              {bn ? "এই রিপোর্টটি প্যাকেজের অন্তর্ভুক্ত" : "This report is part of a package"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {bn
                ? `"${lockedTitle}" ব্যবহার করতে অনুগ্রহ করে প্যাকেজ ক্রয় করুন। প্যাকেজ ক্রয়ের পর আপনি এই রিপোর্টসহ অন্যান্য প্রিমিয়াম ফিচার ব্যবহার করতে পারবেন।`
                : `To use "${lockedTitle}", please purchase a package. After purchase, you will get access to this report and other premium features.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" onClick={() => setLockedOpen(false)}>
              {bn ? "বন্ধ করুন" : "Close"}
            </Button>
            <Button asChild>
              <Link to="/buy-messages" onClick={() => setLockedOpen(false)}>
                {bn ? "প্যাকেজ ক্রয় করুন" : "Buy Package"}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
