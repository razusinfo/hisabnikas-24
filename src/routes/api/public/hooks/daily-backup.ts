import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/daily-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Authenticate caller using the Supabase publishable/anon key
        // (canonical pattern for pg_cron-triggered endpoints).
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const provided =
          request.headers.get("apikey") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runBackupForUser } = await import("@/lib/server-backup.server");

        // Find all users whose auto_daily is on and last backup was >20h ago (or never)
        const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
        const { data: conns, error } = await supabaseAdmin
          .from("google_drive_connections")
          .select("user_id, last_backup_at")
          .eq("auto_daily", true);
        if (error) {
          return Response.json({ ok: false, error: "internal_error" }, { status: 500 });
        }

        const targets = (conns ?? []).filter(
          (c) => !c.last_backup_at || (c.last_backup_at as string) < cutoff,
        );

        let succeeded = 0;
        let failed = 0;
        for (const c of targets) {
          try {
            await runBackupForUser(supabaseAdmin, c.user_id as string);
            succeeded++;
          } catch {
            failed++;
          }
        }
        return Response.json({
          ok: true,
          total_connections: conns?.length ?? 0,
          processed: targets.length,
          succeeded,
          failed,
        });
      },
    },
  },
});
