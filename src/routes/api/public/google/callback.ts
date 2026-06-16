import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        const redirectUri = `${url.protocol}//${url.host}/api/public/google/callback`;
        const appRedirect = `${url.protocol}//${url.host}/backup-restore`;

        if (error) {
          return Response.redirect(`${appRedirect}?drive_error=${encodeURIComponent(error)}`, 302);
        }
        if (!code || !state) {
          return Response.redirect(`${appRedirect}?drive_error=missing_code`, 302);
        }

        const { verifyState, exchangeCodeForTokens, parseIdTokenEmail } = await import(
          "@/lib/google-oauth.server"
        );
        const userId = verifyState(state);
        if (!userId) {
          return Response.redirect(`${appRedirect}?drive_error=invalid_state`, 302);
        }

        try {
          const tokens = await exchangeCodeForTokens(code, redirectUri);
          if (!tokens.refresh_token) {
            return Response.redirect(
              `${appRedirect}?drive_error=no_refresh_token`,
              302,
            );
          }
          const email = parseIdTokenEmail(tokens.id_token);
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error: upErr } = await supabaseAdmin
            .from("google_drive_connections")
            .upsert(
              {
                user_id: userId,
                refresh_token: tokens.refresh_token,
                access_token: tokens.access_token,
                access_token_expires_at: expiresAt,
                google_email: email,
                auto_daily: true,
              },
              { onConflict: "user_id" },
            );
          if (upErr) throw new Error(upErr.message);

          return Response.redirect(`${appRedirect}?drive_connected=1`, 302);
        } catch (e: any) {
          console.error("Google OAuth callback error:", e);
          return Response.redirect(
            `${appRedirect}?drive_error=${encodeURIComponent(e.message || "exchange_failed")}`,
            302,
          );
        }
      },
    },
  },
});
