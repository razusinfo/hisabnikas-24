import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
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
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

const reportCards = [
  {
    title: "লাভ ক্ষতি",
    titleEn: "Profit & Loss",
    description: "বিক্রয়, ক্রয় ও খরচের ভিত্তিকে লাভ-ক্ষতির বিস্তারিত বিবরণ।",
    to: "/profit-loss",
    icon: TrendingUp,
    color: "text-teal-600",
    bg: "bg-teal-50",
  },
  {
    title: "বিক্রয় রিপোর্ট",
    titleEn: "Sales Report",
    description: "দৈনিক, সাপ্তাহিক ও মাসিক বিক্রয়ের সংক্ষিপ্ত বিবরণ।",
    to: "/sales",
    icon: Receipt,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    title: "ক্রয় রিপোর্ট",
    titleEn: "Purchase Report",
    description: "সরবরাহকারী ও তারিখ অনুযায়ী ক্রয়ের বিবরণ।",
    to: "/purchases",
    icon: ShoppingCart,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    title: "পণ্যের রিপোর্ট",
    titleEn: "Products Report",
    description: "স্টক, ক্যাটাগরি ও মূল্য অনুযায়ী পণ্যের তালিকা।",
    to: "/products",
    icon: Package,
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    title: "কাস্টমার রিপোর্ট",
    titleEn: "Customer Report",
    description: "ক্রেতাদের বাকি, বিক্রয় ও পরিশোধের বিবরণ।",
    to: "/customers",
    icon: Users,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
  },
  {
    title: "বাকির রিপোর্ট",
    titleEn: "Due Report",
    description: "পরিশোধযোগ্য ও আদায়যোগ্য বাকির বিস্তারিত তালিকা।",
    to: "/expenses",
    icon: Wallet,
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
  {
    title: "মোবাইল ব্যাংকিং রিপোর্ট",
    titleEn: "Mobile Banking Report",
    description: "বিকাশ, নগদ, রকেট ইত্যাদি মোবাইল ব্যাংকিং লেনদেনের বিবরণ।",
    to: "/cashbook",
    icon: Smartphone,
    color: "text-pink-600",
    bg: "bg-pink-50",
  },
  {
    title: "ব্যাংক লেনদেন রিপোর্ট",
    titleEn: "Bank Transaction Report",
    description: "ব্যাংক অ্যাকাউন্টের জমা ও উত্তোলনের সম্পূর্ণ বিবরণ।",
    to: "/cashbook",
    icon: Landmark,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    title: "বিক্রয় অনুযায়ী লাভ ক্ষতি",
    titleEn: "Sales-wise Profit & Loss",
    description: "প্রতিটি বিক্রয় অনুযায়ী লাভ ও ক্ষতির বিশ্লেষণ।",
    to: "/profit-loss",
    icon: PieChart,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    title: "স্টক সামারী",
    titleEn: "Stock Summary",
    description: "বর্তমান স্টকের সংক্ষিপ্ত বিবরণ ও মূল্যমান।",
    to: "/products",
    icon: Boxes,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  {
    title: "স্টক পরিবর্তনের রিপোর্ট",
    titleEn: "Stock Movement Report",
    description: "পণ্যের স্টক বৃদ্ধি ও হ্রাসের বিস্তারিত বিবরণ।",
    to: "/products",
    icon: Repeat,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    title: "খরচের ক্যাটাগরি",
    titleEn: "Expense Category",
    description: "ক্যাটাগরি অনুযায়ী খরচের সংক্ষিপ্ত বিবরণ।",
    to: "/expenses",
    icon: Tags,
    color: "text-fuchsia-600",
    bg: "bg-fuchsia-50",
  },
  {
    title: "খরচের ধরন",
    titleEn: "Expense Type",
    description: "ধরন অনুযায়ী খরচের বিস্তারিত বিশ্লেষণ।",
    to: "/expenses",
    icon: Layers,
    color: "text-yellow-600",
    bg: "bg-yellow-50",
  },
  {
    title: "খরচ",
    titleEn: "Expenses",
    description: "সকল খরচের বিস্তারিত বিবরণ ও বিশ্লেষণ।",
    to: "/expenses",
    icon: CreditCard,
    color: "text-red-600",
    bg: "bg-red-50",
  },
];

function ReportsPage() {
  const { t, lang } = useI18n();
  const bn = lang === "bn";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader title={t("reports")} subtitle={bn ? "সব রিপোর্ট এক জায়গায়" : "All reports in one place"} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.to}
              to={card.to}
              className="group block rounded-2xl border border-border bg-card hover:shadow-md transition-all hover:border-primary/30"
            >
              <Card className="border-0 shadow-none bg-transparent">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className={`h-10 w-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
