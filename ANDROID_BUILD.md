# হিসাব নিকাশ-২৪ — Android App Build Guide

আপনার POS সিস্টেমকে Android APK তে রূপান্তর করার সম্পূর্ণ গাইড।

## প্রয়োজনীয় Software (আপনার computer এ)

- **Node.js** 20+ ([download](https://nodejs.org))
- **Android Studio** ([download](https://developer.android.com/studio)) — Android SDK সহ
- **Java JDK 17** (Android Studio এর সাথে আসে)
- **Git**

## ধাপ ১: Project Export ও Clone

1. Lovable এর top-right **GitHub** বাটনে ক্লিক করে project কে GitHub এ export করুন
2. আপনার computer এ clone করুন:
   ```bash
   git clone <your-repo-url>
   cd <project-folder>
   npm install
   ```

## ধাপ ২: Android Platform যোগ করুন

```bash
npx cap add android
npx cap update android
```

এটি `android/` folder তৈরি করবে।

## ধাপ ৩: Web App Build

```bash
npm run build
```

## ধাপ ৪: Native Project এ Sync

```bash
npx cap sync android
```

> প্রতিবার code change এর পর `npm run build && npx cap sync` চালাতে হবে।

## ধাপ ৫: Android Studio তে চালান

```bash
npx cap open android
```

Android Studio তে:
- **Run ▶** বাটনে ক্লিক করে emulator/connected phone এ test করুন
- **Build → Generate Signed App Bundle / APK** থেকে release build তৈরি করুন

## ধাপ ৬: Production Build (Play Store এর জন্য)

`capacitor.config.ts` থেকে `server` block টা remove বা comment out করুন:

```ts
// server: { ... }  ← এটা remove করুন
```

এরপর আবার build করুন:
```bash
npm run build
npx cap sync android
```

তারপর Android Studio তে **Build → Generate Signed Bundle (.aab)** — এটাই Play Store এ upload করবেন।

## Native Features

ইতিমধ্যে install করা plugins:
- `@capacitor/camera` — ছবি তোলা
- `@capacitor/barcode-scanner` — Product barcode/QR scan
- `@capacitor/preferences` — Offline local storage

ব্যবহারের উদাহরণ:
```ts
import { CapacitorBarcodeScanner } from '@capacitor/barcode-scanner';

const result = await CapacitorBarcodeScanner.scanBarcode({
  hint: 17, // ALL formats
});
console.log(result.ScanResult);
```

## Permissions

`android/app/src/main/AndroidManifest.xml` এ এই permissions গুলো auto-add হবে:
- `CAMERA` — barcode scan ও ছবি তোলার জন্য
- `INTERNET` — API call এর জন্য

## Troubleshooting

- **Gradle sync failed**: Android Studio তে File → Invalidate Caches → Restart
- **SDK not found**: Android Studio → SDK Manager থেকে Android SDK 34+ install করুন
- **App white screen**: `npm run build` চালিয়ে `npx cap sync` করুন

## আরও তথ্য

বিস্তারিত blog: https://lovable.dev/blogs/TODO
