import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/business-profile")({
  component: BusinessProfilePage,
});

async function resizeImage(file: File, maxW: number, maxH: number): Promise<Blob | null> {
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("decode failed"));
      i.src = dataUrl;
    });
    const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", 0.9),
    );
  } catch {
    return null;
  }
}


type Profile = {
  id: string;
  company_name: string | null;
  logo_url: string | null;
};

function BusinessProfilePage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", "business"],
    queryFn: async (): Promise<Profile> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, company_name, logo_url")
        .eq("id", u.user.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    if (profileQuery.data) {
      setCompanyName(profileQuery.data.company_name ?? "");
    }
  }, [profileQuery.data]);

  const logoUrlQuery = useQuery({
    queryKey: ["logo-signed", profileQuery.data?.logo_url],
    enabled: !!profileQuery.data?.logo_url,
    queryFn: async () => {
      const path = profileQuery.data!.logo_url!;
      const { data, error } = await supabase.storage
        .from("business-logos")
        .createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  const saveName = useMutation({
    mutationFn: async () => {
      if (!profileQuery.data) throw new Error("No profile");
      const { error } = await supabase
        .from("profiles")
        .update({ company_name: companyName.trim() || null })
        .eq("id", profileQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("settingsSaved"));
      qc.invalidateQueries({ queryKey: ["profile", "business"] });
      qc.invalidateQueries({ queryKey: ["app-brand"] });
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      if (!profileQuery.data) throw new Error("No profile");

      const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
      const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
      if (!ALLOWED.includes(file.type)) {
        throw new Error(t("logoInvalidType"));
      }
      if (file.size > MAX_BYTES) {
        throw new Error(t("logoTooLarge"));
      }

      let uploadBlob: Blob = file;
      let ext = file.name.split(".").pop()?.toLowerCase() || "png";
      let contentType = file.type;

      // Resize raster images to max 512x512 (preserve aspect ratio); skip SVG
      if (file.type !== "image/svg+xml") {
        const resized = await resizeImage(file, 512, 512);
        if (resized) {
          uploadBlob = resized;
          ext = "webp";
          contentType = "image/webp";
        }
      }

      const path = `${profileQuery.data.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("business-logos")
        .upload(path, uploadBlob, { upsert: true, contentType });
      if (upErr) throw upErr;
      if (profileQuery.data.logo_url) {
        await supabase.storage.from("business-logos").remove([profileQuery.data.logo_url]);
      }
      const { error } = await supabase
        .from("profiles")
        .update({ logo_url: path })
        .eq("id", profileQuery.data.id);
      if (error) throw error;
    },

    onSuccess: () => {
      toast.success(t("settingsSaved"));
      qc.invalidateQueries({ queryKey: ["profile", "business"] });
      qc.invalidateQueries({ queryKey: ["app-brand"] });
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeLogo = useMutation({
    mutationFn: async () => {
      if (!profileQuery.data?.logo_url) return;
      await supabase.storage.from("business-logos").remove([profileQuery.data.logo_url]);
      const { error } = await supabase
        .from("profiles")
        .update({ logo_url: null })
        .eq("id", profileQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", "business"] });
      qc.invalidateQueries({ queryKey: ["app-brand"] });
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl space-y-6">
      <PageHeader title={t("businessProfile")} subtitle={t("businessProfileDesc")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("businessLogo")}</CardTitle>
          <CardDescription>{t("businessLogoDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {logoUrlQuery.data ? (
              <img
                src={logoUrlQuery.data}
                alt="logo"
                className="h-24 w-24 rounded-md object-contain border bg-muted shrink-0"
              />
            ) : (
              <div className="h-24 w-24 rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground shrink-0">
                {companyName.charAt(0) || "—"}
              </div>
            )}
            <div className="flex-1 space-y-2">
              <Label htmlFor="logo-file" className="cursor-pointer">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border bg-background hover:bg-accent text-sm font-medium min-h-11">
                  {uploadLogo.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {t("uploadLogo")}
                </div>
                <Input
                  id="logo-file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadLogo.isPending}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadLogo.mutate(f);
                    e.target.value = "";
                  }}
                />
              </Label>
              {profileQuery.data?.logo_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onClick={() => removeLogo.mutate()}
                  disabled={removeLogo.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("removeLogo")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("companyName")}</CardTitle>
          <CardDescription>{t("companyNameDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>{t("companyName")}</Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t("companyName")}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveName.mutate()} disabled={saveName.isPending}>
              {saveName.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
