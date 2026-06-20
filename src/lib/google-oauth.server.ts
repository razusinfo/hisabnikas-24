// Server-only Google OAuth helpers. Never import from client code.
import { createHmac, timingSafeEqual } from "crypto";

export const GOOGLE_CLIENT_ID =
  "821062764141-gflk11nbnn17ndlrinjgdct4pfos3sak.apps.googleusercontent.com";
export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const BACKUP_FOLDER_NAME = "HisabNikash Backups";

function signingSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error(
      "Missing signing secret: set SUPABASE_SERVICE_ROLE_KEY or GOOGLE_CLIENT_SECRET",
    );
  }
  return secret;
}

export function signState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = createHmac("sha256", signingSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [userId, ts, sig] = parts;
    const expected = createHmac("sha256", signingSecret())
      .update(`${userId}.${ts}`)
      .digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    // 15 minutes max
    if (Date.now() - Number(ts) > 15 * 60 * 1000) return null;
    return userId;
  } catch {
    return null;
  }
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `openid email ${GOOGLE_DRIVE_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET not configured");

  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: secret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${txt}`);
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
    scope: string;
    token_type: string;
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET not configured");

  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: secret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Refresh failed: ${res.status} ${txt}`);
  }
  return (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };
}

export function parseIdTokenEmail(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const [, payload] = idToken.split(".");
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return json.email ?? null;
  } catch {
    return null;
  }
}

// Drive helpers (server-side, using access token)
export async function ensureBackupFolder(accessToken: string, existingFolderId?: string | null): Promise<string> {
  if (existingFolderId) {
    // verify it still exists
    const verify = await fetch(
      `https://www.googleapis.com/drive/v3/files/${existingFolderId}?fields=id,trashed`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (verify.ok) {
      const j = await verify.json();
      if (!j.trashed) return existingFolderId;
    }
  }
  // With drive.file scope, only files created by this app are visible.
  const q = encodeURIComponent(
    `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const search = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (search.ok) {
    const j = await search.json();
    if (j.files?.length) return j.files[0].id;
  } else {
    const txt = await search.text();
    throw new Error(`Drive folder search failed: ${search.status} ${txt}`);
  }
  const create = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!create.ok) {
    const txt = await create.text();
    throw new Error(`Failed to create backup folder: ${create.status} ${txt}`);
  }
  const j = await create.json();
  if (!j.id) throw new Error("Drive folder create returned no id");
  return j.id;
}

export async function uploadBackupToDrive(
  accessToken: string,
  folderId: string,
  filename: string,
  data: unknown,
): Promise<{ id: string; name: string }> {
  const metadata = { name: filename, parents: [folderId], mimeType: "application/json" };
  const boundary = `bnd_${Math.random().toString(36).slice(2)}`;
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(data)}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive upload failed: ${res.status} ${txt}`);
  }
  return await res.json();
}
