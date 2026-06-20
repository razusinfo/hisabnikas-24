## লক্ষ্য

Android ফোনের bKash/Nagad/Rocket/Upay SMS → SMS Forwarder অ্যাপ → Lovable Cloud public API → ডাটাবেস → POS-এ অটো পেমেন্ট এন্ট্রি (cashbook-এ income)।

## ১. ডাটাবেস (migration)

নতুন টেবিল `mfs_sms_inbox`:
- `owner_id` (uuid) — কোন ইউজারের
- `device_secret_hash` — কোন ফোন থেকে এসেছে যাচাইয়ের জন্য
- `raw_body` (text) — পুরো SMS
- `sender` (text) — যেমন `bKash`, `NAGAD`
- `received_at` (timestamptz)
- `provider` (bkash/nagad/rocket/upay/unknown) — পার্স করে বসানো
- `txn_id` (text, unique per owner) — ডুপ্লিকেট ঠেকাতে
- `amount` (numeric)
- `sender_msisdn` (text) — যিনি পাঠিয়েছেন
- `account_number` (text) — কোন মার্চেন্ট/পার্সোনালে এসেছে (মিল গেলে `mfs_accounts` থেকে)
- `status` — `pending` / `posted` / `ignored` / `duplicate`
- `cashbook_id` (uuid, nullable) — যে cashbook এন্ট্রি বানানো হয়েছে
- `error` (text)

আরও:
- `profiles` টেবিলে `sms_device_secret_hash` ও `sms_auto_post` (boolean, default true) কলাম যোগ।
- RLS: শুধু owner দেখতে/মুছতে/আপডেট পারবেন; insert হবে শুধু service role দিয়ে (edge function)।
- GRANT যথাযথভাবে।

## ২. Public API endpoint

`src/routes/api/public/mfs-sms.ts` — `POST` হ্যান্ডলার:
1. Body: `{ device_secret, sender, body, received_at }`
2. `device_secret` থেকে hash বানিয়ে `profiles.sms_device_secret_hash` মিলিয়ে owner খুঁজে বের করব। না পেলে 401।
3. SMS body পার্সার (নিচে): provider, amount, txn_id, sender_msisdn, account_number বের করে।
4. `mfs_sms_inbox`-এ insert (txn_id ডুপ্লিকেট হলে `duplicate` স্ট্যাটাস)।
5. `profiles.sms_auto_post = true` হলে `cashbook`-এ income এন্ট্রি বানিয়ে `cashbook_id` সেট ও `status='posted'`।
6. `supabaseAdmin` ব্যবহার (verified caller, RLS bypass প্রয়োজন)।
7. JSON রেসপন্স: `{ ok, status, txn_id, cashbook_id }`।

### SMS parser (provider-specific regex)

- **bKash**: `Cash In Tk 500.00 from 0171XXXXXXX ... TrxID ABC123 at 12/06/2026 ...`
- **Nagad**: `Money Received. Amount: Tk 500.00 ... Sender: 0171... TxnID: XYZ`
- **Rocket / Upay**: similar regex প্যাটার্ন।
ম্যাচ না হলে provider='unknown', status='ignored'।

## ৩. ইউজার সেটিংস UI

`/mobile-banking` পৃষ্ঠায় নতুন কার্ড "SMS Auto-Capture":
- "ডিভাইস সিক্রেট তৈরি করুন" বাটন → র‌্যান্ডম টোকেন জেনারেট, hash সেইভ, প্লেইন টোকেন একবার দেখানো হবে copy করার জন্য।
- POST URL দেখানো হবে: `https://{published}/api/public/mfs-sms`
- SMS Forwarder অ্যাপে কীভাবে সেট করতে হয় তার সংক্ষিপ্ত নির্দেশনা (URL, JSON template, header)।
- Auto-post toggle (`sms_auto_post`)।

## ৪. Inbox UI

`/mobile-banking`-এ নতুন কার্ড "সাম্প্রতিক SMS লেনদেন":
- `mfs_sms_inbox` থেকে সর্বশেষ ৫০টি দেখাবে: তারিখ, provider, amount, txn_id, sender, status।
- pending/ignored row-এ "ম্যানুয়ালি পোস্ট করুন" বা "ডিলিট" বাটন।

## ৫. টেকনিক্যাল বিস্তারিত

- Edge endpoint পাবলিক — `/api/public/mfs-sms`। নিরাপত্তা: `device_secret` SHA-256 hash মিলিয়ে owner verify। Rate-limit আপাতত নেই (ফোন থেকে কম ভলিউম)।
- Cashbook insert: `type='income'`, `method=` provider, `amount`, `description='SMS: '+raw[:60]`, `note='TrxID '+txn_id`, `entry_date=received_at::date`, `owner_id=owner`।
- Idempotency: `mfs_sms_inbox` এ unique `(owner_id, txn_id)` constraint।
- Time zone: SMS সময় Bangladesh time — `received_at` ISO-8601 হিসেবে নেব; না দিলে `now()`।

## ডেলিভারেবল

1. মাইগ্রেশন: টেবিল + কলাম + RLS + GRANT।
2. `src/routes/api/public/mfs-sms.ts` — parser সহ public POST endpoint।
3. `src/routes/_authenticated/mobile-banking.tsx`-এ Setup কার্ড + Inbox কার্ড।
4. একটি ছোট server function `generate_sms_device_secret` যা নতুন secret তৈরি করে hash সেইভ করবে এবং প্লেইন টোকেন রিটার্ন করবে।

## আপনাকে যা করতে হবে

প্লেস্টোরের কোনো SMS Forwarder অ্যাপ (যেমন "SMS Forwarder" / "SMS to URL") ইনস্টল করে:
- POST URL: পাবলিশড URL
- Body template: `{"device_secret":"…","sender":"{sender}","body":"{message}","received_at":"{timestamp}"}`
- Header: `Content-Type: application/json`
- Trigger: bKash/Nagad/Rocket/Upay sender filter

## অনুমোদন দিলে শুরু করব। কিছু পরিবর্তন চান?