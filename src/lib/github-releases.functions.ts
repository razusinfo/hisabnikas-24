import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Asset = {
  name: string;
  size: number;
  download_url: string;
  content_type: string;
  updated_at: string;
};

type ReleaseInfo = {
  configured: boolean;
  repo: string;
  hasToken: boolean;
  release: {
    name: string;
    tag: string;
    html_url: string;
    published_at: string | null;
    prerelease: boolean;
    assets: Asset[];
  } | null;
  artifacts: {
    name: string;
    size: number;
    created_at: string;
    expired: boolean;
    workflow_url: string;
  }[];
  error?: string;
};

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

export const getGithubReleases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { repo: string }) => {
    if (!input || typeof input.repo !== "string") throw new Error("repo required");
    return { repo: input.repo.trim() };
  })
  .handler(async ({ data }): Promise<ReleaseInfo> => {
    const repo = data.repo;
    const token = process.env.GITHUB_TOKEN;
    const hasToken = Boolean(token);

    const base: ReleaseInfo = {
      configured: REPO_RE.test(repo),
      repo,
      hasToken,
      release: null,
      artifacts: [],
    };

    if (!base.configured) {
      return { ...base, error: "Invalid repo format. Use owner/repo." };
    }

    const baseHeaders: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "HisabNikash24-App",
    };
    const authedHeaders: Record<string, string> = token
      ? { ...baseHeaders, Authorization: `Bearer ${token}` }
      : baseHeaders;

    // Try authed first (if token); on 401/403 fall back to unauthenticated
    // (works for public repos and avoids breaking when GITHUB_TOKEN is stale/invalid).
    async function ghFetch(url: string) {
      let res = await fetch(url, { headers: authedHeaders });
      if (token && (res.status === 401 || res.status === 403)) {
        const retry = await fetch(url, { headers: baseHeaders });
        if (retry.ok || retry.status === 404) return retry;
      }
      return res;
    }

    try {
      // Latest release
      const relRes = await ghFetch(`https://api.github.com/repos/${repo}/releases/latest`);
      if (relRes.ok) {
        const rel = (await relRes.json()) as {
          name: string | null;
          tag_name: string;
          html_url: string;
          published_at: string | null;
          prerelease: boolean;
          assets: Array<{
            name: string;
            size: number;
            browser_download_url: string;
            url: string;
            content_type: string;
            updated_at: string;
          }>;
        };
        base.release = {
          name: rel.name || rel.tag_name,
          tag: rel.tag_name,
          html_url: rel.html_url,
          published_at: rel.published_at,
          prerelease: rel.prerelease,
          assets: rel.assets.map((a) => ({
            name: a.name,
            size: a.size,
            // browser_download_url works for public repos; for private, use API url with token (not exposable to client)
            download_url: a.browser_download_url,
            content_type: a.content_type,
            updated_at: a.updated_at,
          })),
        };
      } else if (relRes.status === 404) {
        // No release yet — not an error, just empty.
      } else if (relRes.status === 401 || relRes.status === 403) {
        return {
          ...base,
          error:
            "GitHub API access denied (private repo বা invalid GITHUB_TOKEN)। নিচের 'সর্বশেষ APK ডাউনলোড' button দিয়ে সরাসরি Releases page থেকে ডাউনলোড করুন।",
        };
      } else {
        return { ...base, error: `Releases API: ${relRes.status} ${relRes.statusText}` };
      }


      // Recent workflow artifacts (requires token + Actions:Read)
      if (hasToken) {
        const artRes = await fetch(
          `https://api.github.com/repos/${repo}/actions/artifacts?per_page=10`,
          { headers: authedHeaders },
        );
        if (artRes.ok) {
          const j = (await artRes.json()) as {
            artifacts: Array<{
              name: string;
              size_in_bytes: number;
              created_at: string;
              expired: boolean;
              workflow_run: { html_url: string };
            }>;
          };
          base.artifacts = j.artifacts.map((a) => ({
            name: a.name,
            size: a.size_in_bytes,
            created_at: a.created_at,
            expired: a.expired,
            workflow_url: a.workflow_run?.html_url || `https://github.com/${repo}/actions`,
          }));
        }
      }

      return base;
    } catch (e) {
      return { ...base, error: e instanceof Error ? e.message : "Unknown error" };
    }
  });
