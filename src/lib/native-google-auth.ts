// Native Google Sign-In helper for Capacitor (Android).
// Uses @codetrix-studio/capacitor-google-auth so the app shows Google's native
// account picker instead of opening the system browser.
//
// The same code is no-op on the web build (returns isNative=false) — the web
// flow keeps using Lovable managed OAuth via lovable.auth.signInWithOAuth.

import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { supabase } from "@/integrations/supabase/client";

let initialized = false;

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function getWebClientId(): string {
  // Web (server) OAuth Client ID from Google Cloud Console.
  // Must be the *Web* client ID (not the Android one) — Supabase verifies
  // ID tokens against this audience.
  const id = (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ?? "";
  return id.trim();
}

async function ensureInitialized() {
  if (initialized) return;
  const clientId = getWebClientId();
  if (!clientId) {
    throw new Error(
      "Google Sign-In কনফিগার করা নেই। VITE_GOOGLE_WEB_CLIENT_ID সেট করুন।",
    );
  }
  await GoogleAuth.initialize({
    clientId,
    scopes: ["profile", "email"],
    grantOfflineAccess: false,
  });
  initialized = true;
}

/**
 * Run Google sign-in natively and create a Supabase session from the ID token.
 * Returns true on success.
 */
export async function signInWithGoogleNative(): Promise<boolean> {
  if (!isNativePlatform()) return false;

  await ensureInitialized();
  const result = await GoogleAuth.signIn();
  const idToken = result.authentication?.idToken;
  if (!idToken) {
    throw new Error("Google থেকে ID token পাওয়া যায়নি।");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw error;
  return true;
}

export async function signOutGoogleNative(): Promise<void> {
  if (!isNativePlatform() || !initialized) return;
  try {
    await GoogleAuth.signOut();
  } catch {
    // ignore — user may already be signed out from Google side
  }
}
