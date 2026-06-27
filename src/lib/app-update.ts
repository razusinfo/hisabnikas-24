// Lightweight in-app update checker for the Capacitor Android build.
// Compares the latest GitHub Release's published_at (or tag) against the
// last-seen value stored in Capacitor Preferences. Works against PUBLIC repos
// with no token (uses unauthenticated GitHub API client-side).

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export type LatestRelease = {
  tag: string;
  name: string;
  publishedAt: string | null;
  htmlUrl: string;
  apkUrl: string | null;
  apkName: string | null;
  apkSize: number | null;
};

const LAST_SEEN_KEY = "hisabnikash24:last_seen_release";

export function getConfiguredRepo(): string {
  const envRepo = (import.meta.env.VITE_GITHUB_REPO as string | undefined)?.trim();
  if (envRepo && envRepo.includes("/")) return envRepo;
  return "razusinfo/hisabnikas-24";
}

export function isNativeAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

export async function fetchLatestRelease(repo = getConfiguredRepo()): Promise<LatestRelease | null> {
  // Try "latest" semver release first; fall back to rolling "latest" tag used by the workflow.
  const urls = [
    `https://api.github.com/repos/${repo}/releases/latest`,
    `https://api.github.com/repos/${repo}/releases/tags/latest`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) continue;
      const r = (await res.json()) as {
        tag_name: string;
        name: string | null;
        published_at: string | null;
        html_url: string;
        assets: Array<{ name: string; size: number; browser_download_url: string }>;
      };
      // Prefer debug APK (directly installable), then any APK.
      const apk =
        r.assets.find((a) => /debug.*\.apk$/i.test(a.name)) ||
        r.assets.find((a) => /\.apk$/i.test(a.name)) ||
        null;
      return {
        tag: r.tag_name,
        name: r.name || r.tag_name,
        publishedAt: r.published_at,
        htmlUrl: r.html_url,
        apkUrl: apk?.browser_download_url ?? null,
        apkName: apk?.name ?? null,
        apkSize: apk?.size ?? null,
      };
    } catch {
      // try next
    }
  }
  return null;
}

export async function getLastSeenRelease(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: LAST_SEEN_KEY });
    return value ?? null;
  } catch {
    return null;
  }
}

export async function markReleaseSeen(release: LatestRelease) {
  const stamp = release.publishedAt || release.tag;
  try {
    await Preferences.set({ key: LAST_SEEN_KEY, value: stamp });
  } catch {
    // ignore
  }
}

export function isNewerThanSeen(release: LatestRelease, lastSeen: string | null): boolean {
  if (!lastSeen) return true; // first-run after install — show once
  const a = release.publishedAt || release.tag;
  return a !== lastSeen;
}

/**
 * On native Android: download triggers the system installer.
 * On web: opens the GitHub release page in a new tab.
 */
export function openDownload(release: LatestRelease) {
  const url = release.apkUrl || release.htmlUrl;
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
