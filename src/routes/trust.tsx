import { createFileRoute, Link } from "@tanstack/react-router";
import appLogo from "@/assets/logo.png.asset.json";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Lock, Database, Cookie, FileText, Mail } from "lucide-react";

export const Route = createFileRoute("/trust")({
  component: TrustPage,
  head: () => ({
    meta: [
      { title: "ট্রাস্ট ও গোপনীয়তা — হিসব নিকাশ-২৪" },
      {
        name: "description",
        content:
          "হিসব নিকাশ-২৪ আপনার ব্যবসায়িক তথ্য কীভাবে সুরক্ষিত রাখে, কী ডেটা সংগ্রহ করে এবং কীভাবে অ্যাক্সেস নিয়ন্ত্রণ করে — সংক্ষিপ্ত বিবরণ।",
      },
    ],
  }),
});

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
        {children}
      </CardContent>
    </Card>
  );
}

function TrustPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between gap-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={appLogo.url} alt="হিসব নিকাশ-২৪" className="h-9 w-9 rounded" />
            <span className="font-semibold">হিসব নিকাশ-২৪</span>
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">সাইন ইন</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl py-10 space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> ট্রাস্ট ও গোপনীয়তা
          </div>
          <h1 className="text-3xl font-bold tracking-tight">আপনার তথ্যের সুরক্ষা</h1>
          <p className="text-muted-foreground">
            এই পৃষ্ঠাটি হিসব নিকাশ-২৪ এর মালিক কর্তৃক রক্ষণাবেক্ষণ করা হয় এবং অ্যাপটির
            নিরাপত্তা, গোপনীয়তা ও ডেটা ব্যবস্থাপনা সম্পর্কে সাধারণ প্রশ্নের উত্তর দেয়।
            এটি কোনো স্বাধীন সার্টিফিকেশন নয়।
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Section icon={Lock} title="অ্যাক্সেস ও অথেনটিকেশন">
            <p>
              ব্যবহারকারীরা ইমেইল/পাসওয়ার্ড, ফোন OTP অথবা Google সাইন-ইন এর মাধ্যমে
              অ্যাকাউন্টে প্রবেশ করেন। প্রতিটি ব্যবহারকারী শুধুমাত্র তার নিজের
              ব্যবসার ডেটা দেখতে ও পরিবর্তন করতে পারেন।
            </p>
            <p>
              অ্যাডমিন ভূমিকা একটি আলাদা টেবিলে সংরক্ষিত — ব্যবহারকারী নিজে নিজের
              ভূমিকা পরিবর্তন করতে পারেন না।
            </p>
          </Section>

          <Section icon={Database} title="ডেটা সংগ্রহ ও সংরক্ষণ">
            <p>
              অ্যাপ যে ডেটা ধারণ করে: প্রোফাইল তথ্য (নাম, ফোন, ব্যবসার নাম),
              পণ্য, ক্রয়-বিক্রয়, খরচ, ক্যাশবুক, গ্রাহক ও বকেয়া রেকর্ড এবং SMS
              পাঠানোর লগ।
            </p>
            <p>
              ডেটা সুরক্ষিত ক্লাউড ডেটাবেসে এনক্রিপ্টেড সংযোগের মাধ্যমে সংরক্ষিত হয়
              এবং সারির পর্যায়ের অ্যাক্সেস নিয়ন্ত্রণ (Row Level Security)
              প্রয়োগ করা থাকে।
            </p>
          </Section>

          <Section icon={ShieldCheck} title="প্ল্যাটফর্ম ও হোস্টিং">
            <p>
              অ্যাপটি Lovable Cloud-এ পরিচালিত হয়, যা Supabase ও Cloudflare-এর
              অবকাঠামোর উপর ভিত্তি করে চলে। ট্রান্সপোর্ট স্তরে HTTPS/TLS ব্যবহার করা হয়।
            </p>
          </Section>

          <Section icon={Cookie} title="কুকি ও সেশন">
            <p>
              আপনাকে সাইন-ইন অবস্থায় রাখতে ব্রাউজার স্টোরেজে একটি সেশন টোকেন রাখা হয়।
              বিজ্ঞাপন বা থার্ড-পার্টি ট্র্যাকিং কুকি ব্যবহার করা হয় না।
            </p>
          </Section>

          <Section icon={FileText} title="সাবপ্রসেসর ও ইন্টিগ্রেশন">
            <ul className="list-disc pl-5 space-y-1">
              <li>Supabase — ডেটাবেস, অথেনটিকেশন ও ফাইল স্টোরেজ</li>
              <li>Cloudflare — হোস্টিং ও কনটেন্ট ডেলিভারি</li>
              <li>BulkSMSBD — গ্রাহকদের কাছে SMS পাঠানোর জন্য (ঐচ্ছিক)</li>
              <li>Google — ঐচ্ছিক সাইন-ইন ও Drive ব্যাকআপের জন্য</li>
            </ul>
          </Section>

          <Section icon={Mail} title="অনুরোধ ও যোগাযোগ">
            <p>
              আপনার ডেটা মুছে ফেলা, রপ্তানি অথবা নিরাপত্তা সংক্রান্ত কোনো বিষয়
              জানাতে অ্যাপের “সাহায্য” পৃষ্ঠা থেকে আমাদের সাথে যোগাযোগ করুন।
            </p>
          </Section>
        </div>

        <p className="text-xs text-muted-foreground">
          এই পৃষ্ঠার বিষয়বস্তু সময়ে সময়ে আপডেট হতে পারে। শেয়ারড-রেসপনসিবিলিটি
          মডেল অনুযায়ী, প্ল্যাটফর্ম-স্তরের নিরাপত্তা Lovable Cloud নিশ্চিত করে,
          এবং অ্যাকাউন্ট-স্তরের ব্যবস্থাপনা (পাসওয়ার্ড, অ্যাক্সেস, ব্যাকআপ)
          ব্যবহারকারীর দায়িত্ব।
        </p>
      </main>
    </div>
  );
}
