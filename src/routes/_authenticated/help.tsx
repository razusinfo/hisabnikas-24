import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Phone,
  Mail,
  MessageCircle,
  Globe,
  Send,
  ChevronDown,
  BookOpen,
  ShoppingCart,
  Package,
  Users,
  Wallet,
  FileText,
  LifeBuoy,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/help")({
  component: HelpPage,
});

const SUPPORT = {
  phone: "+8801XXXXXXXXX",
  whatsapp: "8801XXXXXXXXX",
  email: "support@hisabnikas24.com",
  website: "https://hisabnikas24.com",
  hours: { en: "Sat – Thu, 9:00 AM – 9:00 PM", bn: "শনি – বৃহঃ, সকাল ৯টা – রাত ৯টা" },
};

function HelpPage() {
  const { t, lang } = useI18n();
  const isBn = lang === "bn";
  const tr = (en: string, bn: string) => (isBn ? bn : en);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success(tr("Copied", "কপি হয়েছে"));
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error(tr("Could not copy", "কপি করা যায়নি"));
    }
  };

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error(tr("Please fill in subject and message", "বিষয় ও বার্তা পূরণ করুন"));
      return;
    }
    setSending(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      const body = encodeURIComponent(
        `${message}\n\n— ${user?.email ?? "user"} (${user?.id ?? ""})`,
      );
      const subj = encodeURIComponent(`[Support] ${subject}`);
      window.location.href = `mailto:${SUPPORT.email}?subject=${subj}&body=${body}`;
      toast.success(tr("Opening your email app…", "ইমেইল অ্যাপ খোলা হচ্ছে…"));
      setSubject("");
      setMessage("");
    } finally {
      setSending(false);
    }
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent(
      tr("Hello, I need help with হিসাব নিকাশ-২৪.", "হ্যালো, আমার হিসাব নিকাশ-২৪ এ সাহায্য দরকার।"),
    );
    window.open(`https://wa.me/${SUPPORT.whatsapp}?text=${text}`, "_blank");
  };

  const quickLinks = [
    { to: "/sales", icon: ShoppingCart, label: t("sales") },
    { to: "/products", icon: Package, label: t("products") },
    { to: "/customers", icon: Users, label: t("customers") },
    { to: "/expenses", icon: Wallet, label: t("expenses") },
    { to: "/purchases", icon: FileText, label: t("purchases") },
    { to: "/settings", icon: BookOpen, label: t("settings") },
  ];

  const faqs = [
    {
      q: tr("How do I record a new sale?", "নতুন বিক্রয় কীভাবে এন্ট্রি করব?"),
      a: tr(
        "Open the Sales page, click 'New Sale', add products to the cart, choose customer & payment method, then click 'Complete Sale'.",
        "বিক্রয় পেজে গিয়ে 'নতুন বিক্রয়' ক্লিক করুন, কার্টে পণ্য যোগ করুন, ক্রেতা ও পেমেন্ট মেথড নির্বাচন করে 'বিক্রয় সম্পন্ন' চাপুন।",
      ),
    },
    {
      q: tr("How do I add or adjust stock?", "স্টক কীভাবে যোগ বা সমন্বয় করব?"),
      a: tr(
        "Go to Products, find the product, and use 'Adjust Stock' to add or remove units. Purchases also auto-update stock.",
        "পণ্য পেজে গিয়ে 'স্টক সমন্বয়' থেকে স্টক যোগ বা কমান। ক্রয় এন্ট্রি করলেও স্টক স্বয়ংক্রিয়ভাবে আপডেট হয়।",
      ),
    },
    {
      q: tr("How do due payments work?", "বাকির হিসাব কীভাবে কাজ করে?"),
      a: tr(
        "When a sale is partially paid, the remainder is added to the customer's due. Record payments later from Sales → Record Payment.",
        "বিক্রয় আংশিক পরিশোধ হলে বাকি অংশ ক্রেতার বাকিতে যোগ হয়। পরে বিক্রয় → পরিশোধ এন্ট্রি থেকে আদায় করুন।",
      ),
    },
    {
      q: tr("How do I change language or currency?", "ভাষা বা মুদ্রা কীভাবে পরিবর্তন করব?"),
      a: tr(
        "Open Settings → Preferences to change language and currency. The language toggle is also available in the top header.",
        "সেটিংস → পছন্দসমূহ থেকে ভাষা ও মুদ্রা পরিবর্তন করুন। উপরের হেডারেও ভাষা টগল আছে।",
      ),
    },
    {
      q: tr("How do I upgrade my plan?", "প্যাকেজ কীভাবে আপগ্রেড করব?"),
      a: tr(
        "Go to Current Package, choose the plan you need, and confirm. Your subscription activates immediately.",
        "বর্তমান প্যাকেজ পেজে গিয়ে পছন্দের প্যাকেজ বেছে নিশ্চিত করুন। সাবস্ক্রিপশন তাৎক্ষণিক সক্রিয় হবে।",
      ),
    },
    {
      q: tr("Is my data safe?", "আমার ডেটা কি সুরক্ষিত?"),
      a: tr(
        "Yes. Your data is stored securely in the cloud with row-level security, and only you can access your records.",
        "হ্যাঁ। আপনার ডেটা ক্লাউডে সুরক্ষিতভাবে সংরক্ষিত, এবং শুধু আপনিই আপনার রেকর্ড দেখতে পান।",
      ),
    },
    {
      q: tr("How do I reset my password?", "পাসওয়ার্ড কীভাবে রিসেট করব?"),
      a: tr(
        "Open Settings → Change Password to set a new password (minimum 6 characters).",
        "সেটিংস → পাসওয়ার্ড পরিবর্তন থেকে নতুন পাসওয়ার্ড দিন (কমপক্ষে ৬ অক্ষর)।",
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title={t("helpSupport")}
        subtitle={tr(
          "We're here to help. Browse FAQs or contact our support team.",
          "আমরা সাহায্যের জন্য প্রস্তুত। সাধারণ প্রশ্ন দেখুন বা সাপোর্ট টিমের সাথে যোগাযোগ করুন।",
        )}
      />

      {/* Contact channels */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ContactCard
          icon={Phone}
          label={tr("Call us", "ফোন করুন")}
          value={SUPPORT.phone}
          action={() => (window.location.href = `tel:${SUPPORT.phone}`)}
          actionLabel={tr("Call", "কল")}
          onCopy={() => copy(SUPPORT.phone, "phone")}
          copied={copied === "phone"}
        />
        <ContactCard
          icon={MessageCircle}
          label="WhatsApp"
          value={`+${SUPPORT.whatsapp}`}
          action={openWhatsApp}
          actionLabel={tr("Chat", "চ্যাট")}
          onCopy={() => copy(`+${SUPPORT.whatsapp}`, "wa")}
          copied={copied === "wa"}
        />
        <ContactCard
          icon={Mail}
          label={tr("Email", "ইমেইল")}
          value={SUPPORT.email}
          action={() => (window.location.href = `mailto:${SUPPORT.email}`)}
          actionLabel={tr("Send", "পাঠান")}
          onCopy={() => copy(SUPPORT.email, "email")}
          copied={copied === "email"}
        />
        <ContactCard
          icon={Globe}
          label={tr("Website", "ওয়েবসাইট")}
          value={SUPPORT.website.replace(/^https?:\/\//, "")}
          action={() => window.open(SUPPORT.website, "_blank")}
          actionLabel={tr("Visit", "দেখুন")}
          onCopy={() => copy(SUPPORT.website, "web")}
          copied={copied === "web"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* FAQs */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-primary" />
              {tr("Frequently Asked Questions", "সাধারণ জিজ্ঞাসা")}
            </CardTitle>
            <CardDescription>
              {tr("Quick answers to the most common questions.", "প্রায়শই জিজ্ঞাসিত প্রশ্নের উত্তর।")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Support form + quick links */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                {tr("Contact Support", "সাপোর্টে বার্তা পাঠান")}
              </CardTitle>
              <CardDescription>{SUPPORT.hours[isBn ? "bn" : "en"]}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitTicket} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="subject">{tr("Subject", "বিষয়")}</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={tr("Briefly describe the issue", "সংক্ষেপে সমস্যা লিখুন")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="message">{tr("Message", "বার্তা")}</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder={tr("Tell us what's happening…", "কী ঘটছে বিস্তারিত লিখুন…")}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={sending}>
                  <Send className="mr-2 h-4 w-4" />
                  {tr("Send Message", "বার্তা পাঠান")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {tr("Quick Links", "দ্রুত লিঙ্ক")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {quickLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <link.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{link.label}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ContactCard({
  icon: Icon,
  label,
  value,
  action,
  actionLabel,
  onCopy,
  copied,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  action: () => void;
  actionLabel: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4 text-primary" />
          <span>{label}</span>
        </div>
        <div className="font-medium text-sm break-all">{value}</div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={action}>
            {actionLabel}
          </Button>
          <Button size="sm" variant="outline" onClick={onCopy} aria-label="Copy">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
