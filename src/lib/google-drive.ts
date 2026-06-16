// Browser-only Google Drive helper using Google Identity Services (GIS).
// Each user signs in with their own Google account; tokens stay in memory.

export const GOOGLE_CLIENT_ID =
  "821062764141-gflk11nbnn17ndlrinjgdct4pfos3sak.apps.googleusercontent.com";
// drive.file scope = app can only see/manage files it created. No access to user's other files.
export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const BACKUP_FOLDER_NAME = "HisabNikash Backups";

declare global {
  interface Window {
    google?: any;
  }
}

let gisLoaded: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Browser only"));
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
  return gisLoaded;
}

type TokenState = { accessToken: string; expiresAt: number } | null;
let token: TokenState = null;

export function isSignedIn() {
  return !!token && token.expiresAt > Date.now() + 5000;
}

export function signOut() {
  if (token && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(token.accessToken, () => {});
    } catch {}
  }
  token = null;
}

export async function requestAccessToken(prompt: "" | "consent" = ""): Promise<string> {
  await loadGis();
  if (isSignedIn()) return token!.accessToken;
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_DRIVE_SCOPE,
      prompt,
      callback: (resp: any) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        token = {
          accessToken: resp.access_token,
          expiresAt: Date.now() + Number(resp.expires_in ?? 3600) * 1000,
        };
        resolve(resp.access_token);
      },
      error_callback: (err: any) => reject(new Error(err?.message || "Google sign-in failed")),
    });
    client.requestAccessToken();
  });
}

async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = await requestAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    token = null;
    const fresh = await requestAccessToken("consent");
    headers.set("Authorization", `Bearer ${fresh}`);
    return fetch(url, { ...init, headers });
  }
  return res;
}

async function ensureBackupFolder(): Promise<string> {
  const q = encodeURIComponent(
    `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const listRes = await authedFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`,
  );
  const listJson = await listRes.json();
  if (listJson.files?.length) return listJson.files[0].id;

  const createRes = await authedFetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const created = await createRes.json();
  if (!created.id) throw new Error("Failed to create Drive folder");
  return created.id;
}

export async function uploadBackup(filename: string, data: unknown): Promise<{ id: string; name: string }> {
  const folderId = await ensureBackupFolder();
  const metadata = { name: filename, parents: [folderId], mimeType: "application/json" };
  const boundary = "lvbl_" + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    JSON.stringify(data) +
    `\r\n--${boundary}--`;

  const res = await authedFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  const json = await res.json();
  if (!res.ok || !json.id) throw new Error(json?.error?.message || "Upload failed");
  return { id: json.id, name: json.name };
}

export type DriveBackupFile = {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
};

export async function listBackups(): Promise<DriveBackupFile[]> {
  const folderId = await ensureBackupFolder();
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await authedFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`,
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to list backups");
  return json.files ?? [];
}

export async function downloadBackup(fileId: string): Promise<any> {
  const res = await authedFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
  );
  if (!res.ok) throw new Error("Failed to download backup");
  return res.json();
}

export async function deleteBackup(fileId: string): Promise<void> {
  const res = await authedFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 204) throw new Error("Failed to delete backup");
}
