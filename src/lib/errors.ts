// Centralized error message sanitization.
// Prevents raw Supabase/Postgres errors from leaking schema details (table names,
// constraint names, "permission denied", etc.) into the UI.

const LEAK_PATTERNS = [
  /duplicate key/i,
  /violates? (unique|foreign key|check|not-null)/i,
  /permission denied/i,
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /syntax error/i,
  /pg(rst|_)/i,
  /JWT/i,
  /row-level security/i,
  /constraint/i,
  /schema/i,
];

export function friendlyError(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!e) return fallback;
  const raw =
    typeof e === "string"
      ? e
      : e instanceof Error
        ? e.message
        : typeof (e as { message?: unknown })?.message === "string"
          ? ((e as { message: string }).message)
          : "";
  if (!raw) return fallback;
  if (LEAK_PATTERNS.some((re) => re.test(raw))) {
    // Log full details for developers; show a generic message to users.
    // eslint-disable-next-line no-console
    console.error("[suppressed error]", e);
    return fallback;
  }
  return raw;
}
