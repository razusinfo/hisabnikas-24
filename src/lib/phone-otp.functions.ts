import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomInt } from "crypto";

function normalizeBdPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("8801") && d.length === 13) return d;
  if (d.startsWith("01") && d.length === 11) return "88" + d;
  if (d.startsWith("1") && d.length === 10) return "880" + d;
  return d;
}

function hashCode(code: string, phone: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

const requestSchema = z.object({ phone: z.string().trim().min(6).max(20) });

export const requestPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => requestSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.BULKSMSBD_API_KEY;
    const senderId = process.env.BULKSMSBD_SENDER_ID;
    if (!apiKey || !senderId) throw new Error("SMS প্রদানকারী কনফিগার করা নেই");

    const phone = normalizeBdPhone(data.phone);
    if (phone.length < 11) throw new Error("সঠিক মোবাইল নাম্বার দিন");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find user by phone (match last 11 digits)
    const last11 = phone.slice(-11);
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, phone")
      .not("phone", "is", null);
    if (pErr) throw new Error(pErr.message);
    const match = (profiles ?? []).find((p) => {
      const d = (p.phone ?? "").replace(/\D/g, "");
      return d.endsWith(last11);
    });
    if (!match) throw new Error("এই নাম্বারে কোনো একাউন্ট পাওয়া যায়নি");

    // Rate limit: reject if last OTP was created < 60s ago
    const { data: recent } = await supabaseAdmin
      .from("phone_otps")
      .select("created_at")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1);
    if (recent && recent.length > 0) {
      const age = Date.now() - new Date(recent[0].created_at).getTime();
      if (age < 60_000) {
        throw new Error(`আবার OTP চাইতে ${Math.ceil((60_000 - age) / 1000)} সেকেন্ড অপেক্ষা করুন`);
      }
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const code_hash = hashCode(code, phone);
    const expires_at = new Date(Date.now() + 5 * 60_000).toISOString();

    const { error: insErr } = await supabaseAdmin
      .from("phone_otps")
      .insert({ phone, code_hash, expires_at });
    if (insErr) throw new Error(insErr.message);

    const body = `হিসব নিকাশ-২৪: আপনার লগইন OTP কোড ${code}। ৫ মিনিটে মেয়াদ শেষ হবে।`;
    const url =
      `http://bulksmsbd.net/api/smsapi?api_key=${encodeURIComponent(apiKey)}` +
      `&type=text&number=${encodeURIComponent(phone)}` +
      `&senderid=${encodeURIComponent(senderId)}` +
      `&message=${encodeURIComponent(body)}`;

    const res = await fetch(url, { method: "GET" });
    const text = (await res.text()).slice(0, 2000);
    let ok = false;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.response_code === 202 || parsed?.response_code === "202") ok = true;
    } catch {
      if (/success/i.test(text)) ok = true;
    }
    if (!ok) throw new Error("OTP পাঠানো যায়নি, কিছুক্ষণ পরে চেষ্টা করুন");

    return { ok: true };
  });

const verifySchema = z.object({
  phone: z.string().trim().min(6).max(20),
  code: z.string().trim().regex(/^\d{6}$/),
});

export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => verifySchema.parse(data))
  .handler(async ({ data }) => {
    const phone = normalizeBdPhone(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("phone_otps")
      .select("id, code_hash, expires_at, attempts, used")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const otp = rows?.[0];
    if (!otp) throw new Error("OTP পাওয়া যায়নি, নতুন OTP চান");
    if (otp.used) throw new Error("এই OTP ব্যবহৃত হয়েছে");
    if (new Date(otp.expires_at).getTime() < Date.now()) throw new Error("OTP এর মেয়াদ শেষ");
    if (otp.attempts >= 5) throw new Error("অনেকবার ভুল হয়েছে, নতুন OTP চান");

    const expected = hashCode(data.code, phone);
    if (expected !== otp.code_hash) {
      await supabaseAdmin
        .from("phone_otps")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);
      throw new Error("OTP সঠিক নয়");
    }

    await supabaseAdmin.from("phone_otps").update({ used: true }).eq("id", otp.id);

    // Find user by phone
    const last11 = phone.slice(-11);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, phone")
      .not("phone", "is", null);
    const match = (profiles ?? []).find((p) => (p.phone ?? "").replace(/\D/g, "").endsWith(last11));
    if (!match) throw new Error("একাউন্ট পাওয়া যায়নি");

    const { data: userRes, error: uErr } = await supabaseAdmin.auth.admin.getUserById(match.id);
    if (uErr || !userRes?.user?.email) throw new Error("ইমেইল পাওয়া যায়নি");
    const email = userRes.user.email;

    // Generate magic link → use token_hash on client to verify and create session
    const { data: linkData, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (lErr || !linkData?.properties?.hashed_token) {
      throw new Error("লগইন টোকেন তৈরি করা যায়নি");
    }

    return { email, tokenHash: linkData.properties.hashed_token };
  });
