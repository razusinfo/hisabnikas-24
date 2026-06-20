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
  received_at: Date | null;
  is_incoming: boolean;
  kind: "personal" | "agent" | "merchant" | "unknown";
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
  // bKash: "Tk 500.00", "Amount Tk1,250.00", "received Tk 500"
  const m =
    body.match(/(?:tk|bdt|৳)\s*\.?\s*([0-9][0-9,]*\.?[0-9]*)/i) ||
    body.match(/amount[:\s]+(?:tk|bdt)?\s*([0-9][0-9,]*\.?[0-9]*)/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseTxnId(body: string): string | null {
  // bKash personal: "TrxID 9A7B6C5D4E", Agent: "TrxID BAA12345678"
  const m =
    body.match(/tr?x[\s.]*id[:#\s]*([A-Z0-9]{6,20})/i) ||
    body.match(/transaction\s*id[:#\s]*([A-Z0-9]{6,20})/i) ||
    body.match(/\bref(?:\.|erence)?\s*[:#]?\s*([A-Z0-9]{6,20})/i);
  return m ? m[1].toUpperCase() : null;
}

function parseSenderMsisdn(body: string): string | null {
  // bKash Personal: "from 01XXXXXXXXX"
  // bKash Agent (Cash In): "from agent 01XXXXXXXXX"
  // bKash Merchant payment received: "from 01XXXXXXXXX"
  const m =
    body.match(/(?:from(?:\s+agent)?|sender|হতে)[^0-9]{0,20}(01[0-9]{9})/i) ||
    body.match(/\b(01[0-9]{9})\b/);
  return m ? m[1] : null;
}

function parseAccountNumber(body: string): string | null {
  const m =
    body.match(/(?:to|account|a\/c|recipient|your)[^0-9]{0,20}(01[0-9]{9})/i);
  return m ? m[1] : null;
}

function parseReceivedAt(body: string): Date | null {
  // bKash formats:
  // "at 21/06/2026 14:23"
  // "12/06/2026 14:23:01"
  // "21-06-2026 14:23"
  const m =
    body.match(/(?:at|on)\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/i) ||
    body.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  let [_, dd, mm, yy, h, mi, s] = m;
  let year = parseInt(yy, 10);
  if (year < 100) year += 2000;
  // Treat as Bangladesh time (UTC+6) — convert to ISO UTC
  const bdMs = Date.UTC(year, parseInt(mm) - 1, parseInt(dd), parseInt(h), parseInt(mi), parseInt(s || "0"));
  const utcMs = bdMs - 6 * 60 * 60 * 1000;
  const d = new Date(utcMs);
  return isNaN(d.getTime()) ? null : d;
}

function detectKind(body: string): Parsed["kind"] {
  const s = body.toLowerCase();
  if (s.includes("cash in") || s.includes("from agent")) return "agent";
  if (s.includes("payment received") || s.includes("merchant")) return "merchant";
  if (s.includes("received") || s.includes("you have received") || s.includes("পেয়েছেন")) return "personal";
  return "unknown";
}

function isIncomingFor(body: string): boolean {
  const s = body.toLowerCase();
  const positive = [
    "received", "cash in", "deposit", "payment received",
    "you have received", "জমা", "পেয়েছেন", "received tk",
  ];
  const negative = [
    "cash out", "send money", "payment sent", "withdraw", "paid to",
    "পরিশোধ", "উত্তোলন", "send tk", "bill pay", "purchase",
  ];
  const hasPos = positive.some((k) => s.includes(k));
  const hasNeg = negative.some((k) => s.includes(k));
  if (hasNeg && !hasPos) return false;
  return hasPos || /tk|bdt|৳/i.test(body);
}

function parseSms(sender: string | null, body: string): Parsed {
  return {
    provider: detectProvider(sender, body),
    amount: parseAmount(body),
    txn_id: parseTxnId(body),
    sender_msisdn: parseSenderMsisdn(body),
    account_number: parseAccountNumber(body),
    received_at: parseReceivedAt(body),
    is_incoming: isIncomingFor(body),
    kind: detectKind(body),
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

        const { data: prof, error: profErr } = await supabaseAdmin
          .from("profiles")
          .select("id, sms_auto_post")
          .eq("sms_device_secret_hash", hash)
          .maybeSingle();
        if (profErr) return json({ ok: false, error: "lookup_failed" }, 500);
        if (!prof?.id) return json({ ok: false, error: "unauthorized" }, 401);

        const ownerId = prof.id as string;
        const autoPost = !!prof.sms_auto_post;

        const parsed = parseSms(senderField, bodyText);
        const headerReceivedAt = receivedAtRaw ? new Date(receivedAtRaw) : null;
        const receivedAt =
          (parsed.received_at && !isNaN(parsed.received_at.getTime()) && parsed.received_at) ||
          (headerReceivedAt && !isNaN(headerReceivedAt.getTime()) && headerReceivedAt) ||
          new Date();

        let status: "pending" | "posted" | "ignored" | "duplicate" | "error" = "pending";
        if (parsed.provider === "unknown" || parsed.amount == null || !parsed.is_incoming) {
          status = "ignored";
        }

        // Duplicate check (per-owner, per-txn_id)
        if (parsed.txn_id && status !== "ignored") {
          const { data: dup } = await supabaseAdmin
            .from("mfs_sms_inbox")
            .select("id")
            .eq("owner_id", ownerId)
            .eq("txn_id", parsed.txn_id)
            .maybeSingle();
          if (dup?.id) status = "duplicate";
        }

        // Insert SMS row first (so we can pass id to RPC for matching)
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("mfs_sms_inbox")
          .insert({
            owner_id: ownerId,
            raw_body: bodyText.slice(0, 2000),
            sender: senderField?.slice(0, 100) ?? null,
            received_at: receivedAt.toISOString(),
            provider: parsed.provider,
            txn_id: parsed.txn_id,
            amount: parsed.amount,
            sender_msisdn: parsed.sender_msisdn,
            account_number: parsed.account_number,
            status,
          })
          .select("id")
          .single();

        if (insErr) {
          // unique-constraint violation → duplicate
          if (String(insErr.code) === "23505") {
            return json({ ok: true, status: "duplicate", txn_id: parsed.txn_id });
          }
          return json({ ok: false, error: "insert_failed", detail: insErr.message }, 500);
        }

        const smsId = inserted.id as string;

        // Auto-match invoice + post when status pending & auto-post is on
        let matchedSaleId: string | null = null;
        if (status === "pending" && autoPost && parsed.amount != null) {
          const { data: matchRes, error: matchErr } = await supabaseAdmin.rpc("process_mfs_sms", {
            _sms_id: smsId,
            _owner_id: ownerId,
            _amount: parsed.amount,
            _sender_msisdn: parsed.sender_msisdn,
            _provider: parsed.provider,
            _txn_id: parsed.txn_id,
            _received_at: receivedAt.toISOString(),
          });
          if (matchErr) {
            await supabaseAdmin
              .from("mfs_sms_inbox")
              .update({ status: "error", error: matchErr.message })
              .eq("id", smsId);
            return json({ ok: false, error: "process_failed", detail: matchErr.message }, 500);
          }
          matchedSaleId = (matchRes as string | null) ?? null;

          // No invoice match — still record as cashbook income, mark posted
          if (!matchedSaleId) {
            const providerLabel: Record<Provider, string> = {
              bkash: "bKash", nagad: "Nagad", rocket: "Rocket", upay: "Upay", unknown: "Mobile Banking",
            };
            const { data: cb, error: cbErr } = await supabaseAdmin
              .from("cashbook")
              .insert({
                owner_id: ownerId,
                entry_date: receivedAt.toISOString().slice(0, 10),
                type: "income",
                category: "Mobile Banking",
                description: `SMS: ${providerLabel[parsed.provider]}${parsed.sender_msisdn ? ` from ${parsed.sender_msisdn}` : ""}`.slice(0, 200),
                amount: parsed.amount,
                method: providerLabel[parsed.provider],
                note: parsed.txn_id ? `TrxID ${parsed.txn_id}` : null,
              })
              .select("id")
              .single();
            if (cbErr) {
              await supabaseAdmin
                .from("mfs_sms_inbox")
                .update({ status: "error", error: cbErr.message })
                .eq("id", smsId);
              return json({ ok: false, error: "cashbook_failed", detail: cbErr.message }, 500);
            }
            await supabaseAdmin
              .from("mfs_sms_inbox")
              .update({ status: "posted", cashbook_id: cb.id })
              .eq("id", smsId);
          }
        }

        return json({
          ok: true,
          id: smsId,
          status: matchedSaleId ? "posted" : status,
          provider: parsed.provider,
          amount: parsed.amount,
          txn_id: parsed.txn_id,
          matched_sale_id: matchedSaleId,
        });
      },
    },
  },
});
