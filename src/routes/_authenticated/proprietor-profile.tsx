import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, UserCircle2, Upload, Trash2 } from "lucide-react";
import { AvatarCropDialog } from "@/components/AvatarCropDialog";

export const Route = createFileRoute("/_authenticated/proprietor-profile")({
  component: ProprietorProfilePage,
});

type Profile = {
  id: string;
  full_name: string | null;
  address: string | null;
  avatar_url: string | null;
};

function ProprietorProfilePage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["proprietor-profile"],
    queryFn: async (): Promise<Profile> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, address, avatar_url")
        .eq("id", u.user.id)
        .single();
      if (error) throw error;
      return data as unknown as Profile;
    },
  });

  const emailQuery = useQuery({
    queryKey: ["auth", "email"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.email ?? "";
    },
  });

  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (profileQuery.data) {
      setFullName(profileQuery.data.full_name ?? "");
      setAddress(profileQuery.data.address ?? "");
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (emailQuery.data) setEmail(emailQuery.data);
  }, [emailQuery.data]);

  const avatarUrlQuery = useQuery({
    queryKey: ["avatar-signed", profileQuery.data?.avatar_url],
    enabled: !!profileQuery.data?.avatar_url,
    queryFn: async () => {
      const path = profileQuery.data!.avatar_url!;
      const { data, error } = await supabase.storage
        .from("business-logos")
        .createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!profileQuery.data) throw new Error("No profile");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          address: address.trim() || null,
        } as never)
        .eq("id", profileQuery.data.id);
      if (error) throw error;

      if (email && email !== emailQuery.data) {
        const { error: e2 } = await supabase.auth.updateUser({ email });
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success(t("settingsSaved"));
      qc.invalidateQueries({ queryKey: ["proprietor-profile"] });
      qc.invalidateQueries({ queryKey: ["auth", "email"] });
      qc.invalidateQueries({ queryKey: ["app-brand"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const uploadAvatar = useMutation({
    mutationFn: async (blob: Blob) => {
      if (!profileQuery.data) throw new Error("No profile");
      const path = `${profileQuery.data.id}/avatar-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("business-logos")
        .upload(path, blob, { upsert: true, contentType: "image/png" });
      if (upErr) throw upErr;
      if (profileQuery.data.avatar_url) {
        await supabase.storage.from("business-logos").remove([profileQuery.data.avatar_url]);
      }
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path } as never)
        .eq("id", profileQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("settingsSaved"));
      setPendingFile(null);
      qc.invalidateQueries({ queryKey: ["proprietor-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAvatar = useMutation({
    mutationFn: async () => {
      if (!profileQuery.data?.avatar_url) return;
      await supabase.storage.from("business-logos").remove([profileQuery.data.avatar_url]);
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null } as never)
        .eq("id", profileQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proprietor-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (profileQuery.isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl space-y-6">
      <PageHeader title={t("profileInfo")} subtitle={t("profileInfoDesc")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("profileInfo")}</CardTitle>
          <CardDescription>{t("profileInfoDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {avatarUrlQuery.data ? (
              <img
                src={avatarUrlQuery.data}
                alt="avatar"
                className="h-24 w-24 rounded-full object-cover border shrink-0"
              />
            ) : (
              <div className="h-24 w-24 rounded-full border border-dashed flex items-center justify-center text-muted-foreground shrink-0">
                <UserCircle2 className="h-12 w-12" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" /> Photo
              </Label>
              <Input
                type="file"
                accept="image/*"
                disabled={uploadAvatar.isPending}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar.mutate(f);
                  e.target.value = "";
                }}
              />
              {profileQuery.data?.avatar_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAvatar.mutate()}
                  disabled={removeAvatar.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> {t("removeLogo")}
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{t("fullName")}</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("email")}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("address")}</Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => saveProfile.mutate()}
              disabled={saveProfile.isPending}
              className="min-w-32"
            >
              {saveProfile.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
