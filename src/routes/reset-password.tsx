import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("পাসওয়ার্ড মিলছে না");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে");
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="w-full max-w-sm bg-card text-card-foreground rounded-2xl border border-border shadow-xl p-6 sm:p-8">
        <h1 className="text-2xl font-display font-semibold mb-2">নতুন পাসওয়ার্ড</h1>
        <p className="text-sm text-muted-foreground mb-6">
          আপনার নতুন পাসওয়ার্ড সেট করুন।
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>নতুন পাসওয়ার্ড</Label>
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>পাসওয়ার্ড নিশ্চিত করুন</Label>
            <Input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button disabled={loading} className="w-full h-11 mt-2">
            পাসওয়ার্ড সেভ করুন
          </Button>
        </form>
      </div>
    </div>
  );
}
