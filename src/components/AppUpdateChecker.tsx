import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import {
  fetchLatestRelease,
  getLastSeenRelease,
  isNativeAndroid,
  isNewerThanSeen,
  markReleaseSeen,
  openDownload,
  type LatestRelease,
} from "@/lib/app-update";

/**
 * Mounts inside the app shell. On native Android only, checks GitHub once on
 * boot for a newer release and shows a non-blocking install prompt.
 */
export function AppUpdateChecker() {
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isNativeAndroid()) return;
    let cancelled = false;
    (async () => {
      // Small delay so we don't compete with first paint.
      await new Promise((r) => setTimeout(r, 2500));
      const latest = await fetchLatestRelease();
      if (cancelled || !latest || !latest.apkUrl) return;
      const lastSeen = await getLastSeenRelease();
      if (isNewerThanSeen(latest, lastSeen)) {
        setRelease(latest);
        setOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = async () => {
    if (release) await markReleaseSeen(release);
    setOpen(false);
  };

  const install = async () => {
    if (release) {
      openDownload(release);
      await markReleaseSeen(release);
    }
    setOpen(false);
  };

  if (!release) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-emerald-600" />
            নতুন আপডেট এসেছে
          </DialogTitle>
          <DialogDescription className="text-sm">
            <span className="font-semibold text-foreground">{release.name}</span>
            <br />
            অ্যাপের নতুন ভার্সন এসেছে। এখনই ডাউনলোড করে ইনস্টল করুন।
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button variant="outline" className="flex-1" onClick={dismiss}>
            <X className="h-4 w-4 mr-1" /> পরে
          </Button>
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={install}>
            <Download className="h-4 w-4 mr-1" /> এখনই ডাউনলোড
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
