import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

type Provider = "bkash" | "nagad" | "rocket" | "upay" | "unknown";

type Parsed = {
  provider: Provider;
  amount: number | null;
  txn_id: string | null;
  sender_msisdn: string | null;
  account_number: string | null;
};

function detectProvider(sender: string | null, body: string): Provider {
  const s = `${sender ?? ""} ${body}`.toLowerCase();
  if (s.includes("bkash") || s.includes("বিকাশ")) return "bkash";
  if (s.includes("nagad") || s.includes("নগদ")) return "nagad";
  if (s.includes("rocket") || s.includes("রকেট") || s.includes("dbbl")) return "rocket";
  if (s.includes("upay") || s.includes("উপায়")) return "upay";
  return "unknown";
}

function parseAmount(body: string): number | null {
  // Common patterns: "Tk 500.00", "Amount: Tk 1,250", "BDT 300"
  const m =
    body.match(/(?:tk|bdt|৳)\s*([0-9][0-9,]*\.?[0-9]*)/i) ||
    body.match(/amount[:\s]+(?:tk|bdt)?\s*([0-9][0-9,]*\.?[0-9]*)/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseTxnId(body: string): string | null {
  // bKash: "TrxID ABC123XYZ", Nagad: "TxnID: XYZ", Rocket: "TxnId XYZ"
  const m =
    body.match(/tr?x[\s.]*id[:#\s]*([A-Z0-9]{6,20})/i) ||
    body.match(/transaction\s*id[:#\s]*([A-Z0-9]{6,20})/i) ||
    body.match(/\bref(?:\.|erence)?\s*[:#]?\s*([A-Z0-9]{6,20})/i);
  return m ? m[1].toUpperCase() : null;
}

function parseSenderMsisdn(body: string): string | null {
  // Bangladeshi mobile: 01XXXXXXXXX (11 digits)
  const m = body.match(/(?:from|sender|হতে)[^0-9]{0,15}(01[0-9]{9})/i) || body.match(/\b(01[0-9]{9})\b/);
  return m ? m[1] : null;
}

function parseAccountNumber(body: string): string | null {
  // "to 01XXXXXXXXX" or "Account 01XXXXXXXXX"
  const m =
    body.match(/(?:to|account|a\/c|recipient)[^0-9]{0,15}(01[0-9]{9})/i) ||
    body.match(/your\s+(?:account|number)[^0-9]{0,15}(01[0-9]{9})/i);
  return m ? m[1] : null;
}

function isIncomingFor(body: string): boolean {
  // Heuristic: only ingest credit/received messages, ignore send/cash-out/withdraw
  const s = body.toLowerCase();
  const positive = ["received", "cash in", "deposit", "payment received", "you have received", "জমা", "পেয়েছেন", "received tk"];
  const negative = ["cash out", "send money", "payment sent", "withdraw", "paid to", "পরিশোধ", "উত্তোলন", "send tk"];
  const hasPos = positive.some((k) => s.includes(k));
  const hasNeg = negative.some((k) => s.includes(k));
  // If both, lean negative (outgoing). If neither, treat as positive when there's an amount.
  if (hasNeg && !hasPos) return false;
  return true;
}

function parseSms(sender: string | null, body: string): Parsed {
  const provider = detectProvider(sender, body);
  return {
    provider,
    amount: parseAmount(body),
    txn_id: parseTxnId(body),
    sender_msisdn: parseSenderMsisdn(body),
    account_number: parseAccountNumber(body),
  };
}

function sha256Hex(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/public/mfs-sms")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return json({ ok: false, error: "invalid_json" }, 400);
        }

        const deviceSecret = String(payload?.device_secret ?? "").trim();
        const senderField = payload?.sender ? String(payload.sender) : null;
        const bodyText = String(payload?.body ?? "").trim();
        const receivedAtRaw = payload?.received_at ? String(payload.received_at) : null;

        if (!deviceSecret || deviceSecret.length < 16) {
          return json({ ok: false, error: "missing_device_secret" }, 401);
        }
        if (!bodyText) {
          return json({ ok: false, error: "missing_body" }, 400);
        }
        if (bodyText.length > 2000) {
          return json({ ok: false, error: "body_too_long" }, 400);
        }

        const hash = sha256Hex(deviceSecret);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Find owner by hash
        const { data: prof, error: profErr } = await supabaseAdmin
          .from("profiles")
          .select("id, sms_auto_post")
          .eq("sms_device_secret_hash", hash)
          .maybeSingle();
        if (profErr) {
          return json({ ok: false, error: "lookup_failed" }, 500);
        }
        if (!prof?.id) {
          return json({ ok: false, error: "unauthorized" }, 401);
        }
        const ownerId = prof.id as string;
        const autoPost = !!prof.sms_auto_post;

        const parsed = parseSms(senderField, bodyText);
        const receivedAt = receivedAtRaw ? new Date(receivedAtRaw) : new Date();
        const safeReceivedAt = isNaN(receivedAt.getTime()) ? new Date() : receivedAt;

        const incoming = isIncomingFor(bodyText);
        let status: "pending" | "posted" | "ignored" | "duplicate" | "error" = "pending";
        if (parsed.provider === "unknown" || parsed.amount == null || !incoming) {
          status = "ignored";
        }

        // Duplicate check
        if (parsed.txn_id && status !== "ignored") {
          const { data: dup } = await supabaseAdmin
            .from("mfs_sms_inbox")
            .select("id")
            .eq("owner_id", ownerId)
            .eq("txn_id", parsed.txn_id)
            .maybeSingle();
          if (dup?.id) status = "duplicate";
        }

        let cashbookId: string | null = null;
        let createError: string | null = null;

        if (status === "pending" && autoPost && parsed.amount != null) {
          const providerLabel: Record<Provider, string> = {
            bkash: "bKash",
            nagad: "Nagad",
            rocket: "Rocket",
            upay: "Upay",
            unknown: "Mobile Banking",
          };
          const desc = `SMS: ${providerLabel[parsed.provider]}${parsed.sender_msisdn ? ` from ${parsed.sender_msisdn}` : ""}`;
          const { data: cb, error: cbErr } = await supabaseAdmin
            .from("cashbook")
            .insert({
              owner_id: ownerId,
              entry_date: safeReceivedAt.toISOString().slice(0, 10),
              type: "income",
              category: "Mobile Banking",
              description: desc.slice(0, 200),
              amount: parsed.amount,
              method: providerLabel[parsed.provider],
              note: parsed.txn_id ? `TrxID ${parsed.txn_id}` : null,
            })
            .select("id")
            .single();
          if (cbErr) {
            status = "error";
            createError = cbErr.message;
          } else {
            cashbookId = cb.id as string;
            status = "posted";
          }
        }

        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("mfs_sms_inbox")
          .insert({
            owner_id: ownerId,
            raw_body: bodyText.slice(0, 2000),
            sender: senderField?.slice(0, 100) ?? null,
            received_at: safeReceivedAt.toISOString(),
            provider: parsed.provider,
            txn_id: parsed.txn_id,
            amount: parsed.amount,
            sender_msisdn: parsed.sender_msisdn,
            account_number: parsed.account_number,
            status,
            cashbook_id: cashbookId,
            error: createError,
          })
          .select("id, status, provider, amount, txn_id, cashbook_id")
          .single();

        if (insErr) {
          return json({ ok: false, error: "insert_failed", detail: insErr.message }, 500);
        }

        return json({ ok: true, ...inserted });
      },
    },
  },
});
