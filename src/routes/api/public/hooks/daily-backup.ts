import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/daily-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Authenticate caller. Accept either:
        //  - a private CRON_SECRET via x-cron-secret / Bearer header, or
        //  - the project's Supabase publishable key via apikey header
        //    (canonical pg_cron pattern; endpoint is idempotent and only
        //    triggers backups for users that opted in and are >20h overdue).
        const cronSecret = process.env.CRON_SECRET;
        const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided =
          request.headers.get("x-cron-secret") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const apikey = request.headers.get("apikey");
        const ok =
          (cronSecret && provided && provided === cronSecret) ||
          (publishable && apikey && apikey === publishable);
        if (!ok) {
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
