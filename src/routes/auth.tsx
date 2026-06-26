import appLogo from "@/assets/hisab-nikash-24-logo-v8.png.asset.json";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { requestPhoneOtp, verifyPhoneOtp } from "@/lib/phone-otp.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const requestOtpFn = useServerFn(requestPhoneOtp);
  const verifyOtpFn = useServerFn(verifyPhoneOtp);

  const onRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestOtpFn({ data: { phone: otpPhone } });
      setOtpSent(true);
      toast.success("OTP পাঠানো হয়েছে");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OTP পাঠানো যায়নি");
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await verifyOtpFn({ data: { phone: otpPhone, code: otpCode } });
      const { error } = await supabase.auth.verifyOtp({
        email: r.email,
        token_hash: r.tokenHash,
        type: "magiclink",
      });
      if (error) throw error;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "লগইন ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard", replace: true });
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName, company_name: companyName, phone },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You can sign in now.");
  };

  const onForgotPassword = async () => {
    if (!email) {
      toast.error("আগে আপনার ইমেইল লিখুন");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("পাসওয়ার্ড রিসেট লিংক ইমেইলে পাঠানো হয়েছে");
  };

  const onGoogle = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (r.error) toast.error(r.error.message);
    if (!r.redirected && !r.error) navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <div className="hidden lg:flex flex-col justify-between flex-1 p-12 relative overflow-hidden border-r border-border">
        <div className="absolute inset-0" style={{ background: "var(--gradient-glow)" }} />
        <div className="relative flex items-center">
          <img src={appLogo.url} alt="হিসব নিকাশ-২৪" className="h-36 w-auto" />
        </div>
        <div className="relative max-w-md space-y-6">
          <h1 className="text-5xl font-display font-semibold leading-[1.05] tracking-tight">
            ব্যবসা করবেন আপনি আর হিসাব রাখবে <span className="text-gradient">হিসব নিকাশ-২৪</span>
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            POS, inventory, customers, dues, and live analytics — in one premium dashboard built for retail and wholesale.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4">
            {[
              ["Real-time", "Dashboard"],
              ["Built-in", "POS"],
              ["EN · বাং", "Bilingual"],
            ].map(([a, b]) => (
              <div key={b} className="card-premium p-4">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{a}</div>
                <div className="font-display font-semibold mt-1">{b}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-muted-foreground">© হিসব নিকাশ-২৪</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm bg-card text-card-foreground rounded-2xl border border-border shadow-xl p-6 sm:p-8 lg:bg-transparent lg:text-foreground lg:rounded-none lg:border-0 lg:shadow-none lg:p-0">
          <div className="flex justify-end mb-4">
            <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-3 py-1.5 ${lang === "en" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang("bn")}
                className={`px-3 py-1.5 ${lang === "bn" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
              >
                বাংলা
              </button>
            </div>
          </div>
          <div className="lg:hidden flex items-center justify-center mb-6">
            <img src={appLogo.url} alt="হিসব নিকাশ-২৪" className="h-24 w-auto" />
          </div>

          <h2 className="text-2xl font-display font-semibold text-center lg:text-left">Welcome</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6 text-center lg:text-left">Sign in to your workspace or create a new one.</p>

          <Button onClick={onGoogle} variant="outline" className="w-full mb-4 h-11">
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1H12v3.2h5.35c-.23 1.45-1.66 4.25-5.35 4.25-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.92 4.13 14.71 3.2 12 3.2 6.97 3.2 2.9 7.27 2.9 12.3s4.07 9.1 9.1 9.1c5.26 0 8.74-3.69 8.74-8.89 0-.6-.07-1.06-.16-1.41z"/></svg>
            {t("continueGoogle")}
          </Button>

          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-widest">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="signin">{t("signIn")}</TabsTrigger>
              <TabsTrigger value="otp">OTP</TabsTrigger>
              <TabsTrigger value="signup">{t("signUp")}</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={onSignIn} className="space-y-3 mt-4">
                <div className="space-y-1.5">
                  <Label>{t("email")}</Label>
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("password")}</Label>
                  <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button disabled={loading} className="w-full h-11 mt-2">{t("signIn")}</Button>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  disabled={loading}
                  className="text-xs text-muted-foreground hover:text-foreground w-full text-center mt-1"
                >
                  পাসওয়ার্ড ভুলে গেছেন?
                </button>
              </form>
            </TabsContent>
            <TabsContent value="otp">
              {!otpSent ? (
                <form onSubmit={onRequestOtp} className="space-y-3 mt-4">
                  <div className="space-y-1.5">
                    <Label>মোবাইল নাম্বার</Label>
                    <Input
                      type="tel"
                      required
                      value={otpPhone}
                      onChange={(e) => setOtpPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                    />
                  </div>
                  <Button disabled={loading} className="w-full h-11 mt-2">
                    OTP পাঠান
                  </Button>
                </form>
              ) : (
                <form onSubmit={onVerifyOtp} className="space-y-3 mt-4">
                  <p className="text-xs text-muted-foreground">
                    {otpPhone} নাম্বারে পাঠানো ৬ ডিজিট OTP কোড লিখুন
                  </p>
                  <div className="space-y-1.5">
                    <Label>OTP কোড</Label>
                    <Input
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                    />
                  </div>
                  <Button disabled={loading} className="w-full h-11 mt-2">
                    লগইন করুন
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
                  >
                    নাম্বার পরিবর্তন করুন
                  </button>
                </form>
              )}
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={onSignUp} className="space-y-3 mt-4">
                <div className="space-y-1.5">
                  <Label>{t("fullName")}</Label>
                  <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("companyName")}</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>মোবাইল নাম্বার</Label>
                  <Input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("email")}</Label>
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("password")}</Label>
                  <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button disabled={loading} className="w-full h-11 mt-2">{t("signUp")}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
