import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/daily-backup")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runBackupForUser } = await import("@/lib/server-backup.server");

        // Find all users whose auto_daily is on and last backup was >20h ago (or never)
        const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
        const { data: conns, error } = await supabaseAdmin
          .from("google_drive_connections")
          .select("user_id, last_backup_at")
          .eq("auto_daily", true);
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const targets = (conns ?? []).filter(
          (c) => !c.last_backup_at || (c.last_backup_at as string) < cutoff,
        );

        const results: { user_id: string; ok: boolean; error?: string }[] = [];
        for (const c of targets) {
          try {
            await runBackupForUser(supabaseAdmin, c.user_id as string);
            results.push({ user_id: c.user_id as string, ok: true });
          } catch (e: any) {
            results.push({ user_id: c.user_id as string, ok: false, error: String(e.message || e) });
          }
        }
        return Response.json({
          ok: true,
          total_connections: conns?.length ?? 0,
          processed: results.length,
          results,
        });
      },
    },
  },
});
