import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const inputSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  phone: z.string().trim().min(6).max(20),
  body: z.string().trim().min(1).max(640),
  kind: z.enum(["due_reminder", "sale_receipt", "payment_receipt"]),
});

function normalizeBdPhone(raw: string): string {
  // Strip non-digits, ensure 8801XXXXXXXXX format expected by BulkSMSBD
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8801") && digits.length === 13) return digits;
  if (digits.startsWith("01") && digits.length === 11) return "88" + digits;
  if (digits.startsWith("1") && digits.length === 10) return "880" + digits;
  return digits;
}

export const sendSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.BULKSMSBD_API_KEY;
    const senderId = process.env.BULKSMSBD_SENDER_ID;
    if (!apiKey || !senderId) {
      throw new Error("SMS provider not configured");
    }

    // 1) Deduct credit + create queued log entry (server-defined function)
    const { data: logId, error: rpcErr } = await context.supabase.rpc(
      "consume_sms_credit" as never,
      {
        _customer_id: data.customerId ?? null,
        _phone: data.phone,
        _body: data.body,
        _kind: data.kind,
      } as never,
    );
    if (rpcErr) throw new Error(rpcErr.message);

    const number = normalizeBdPhone(data.phone);
    const url =
      `http://bulksmsbd.net/api/smsapi?api_key=${encodeURIComponent(apiKey)}` +
      `&type=text&number=${encodeURIComponent(number)}` +
      `&senderid=${encodeURIComponent(senderId)}` +
      `&message=${encodeURIComponent(data.body)}`;

    let status = "failed";
    let providerMsgId: string | null = null;
    let providerResponse = "";

    try {
      const res = await fetch(url, { method: "GET" });
      providerResponse = (await res.text()).slice(0, 2000);
      try {
        const parsed = JSON.parse(providerResponse);
        if (parsed?.response_code === 202 || parsed?.response_code === "202") {
          status = "sent";
          providerMsgId = parsed?.message_id ? String(parsed.message_id) : null;
        }
      } catch {
        if (/success/i.test(providerResponse)) status = "sent";
      }
    } catch (err) {
      providerResponse = err instanceof Error ? err.message : String(err);
    }

    // 2) Update log with provider outcome (admin client — bypasses RLS)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("sms_logs")
      .update({
        status,
        provider_msg_id: providerMsgId,
        provider_response: providerResponse,
      })
      .eq("id", logId as string);

    if (status !== "sent") {
      throw new Error(`SMS পাঠানো যায়নি: ${providerResponse || "অজানা ত্রুটি"}`);
    }

    return { ok: true, logId, providerMsgId };
  });
