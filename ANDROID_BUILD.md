# হিসাব নিকাশ-২৪ — One-Click Android APK Build

উচ্চ মানের Android APK (debug / release) অথবা Play Store এর জন্য AAB তৈরি করুন **মাত্র একটি কমান্ডে**।

---

## ⚡ One-Click কমান্ড

প্রথমবার (project clone করার পর):

```bash
git clone <your-repo-url> && cd <project-folder>
chmod +x scripts/build-android.sh
./scripts/build-android.sh
```

পরবর্তী বিল্ডে শুধু:

```bash
./scripts/build-android.sh              # Debug APK (testing)
./scripts/build-android.sh release      # Release APK (sign করার জন্য)
./scripts/build-android.sh bundle       # Play Store এর AAB
```

আউটপুট পাবেন → `android-output/` ফোল্ডারে, timestamp সহ।

---

## ✅ যা স্ক্রিপ্ট স্বয়ংক্রিয়ভাবে করে

1. সকল dependencies ইন্সটল (`npm install`)
2. Vite production build
3. Android platform যোগ (প্রথমবার)
4. Capacitor sync — সব native plugin আপডেট
5. Gradle দিয়ে APK/AAB তৈরি
6. ফাইল কপি করে `android-output/` এ রাখা

---

## 🔧 প্রথমবার প্রয়োজনীয় Setup (computer-এ, একবার)

| Software | Download |
|----------|----------|
| Node.js 20+ | https://nodejs.org |
| Android Studio | https://developer.android.com/studio |
| Java JDK 17 | Android Studio এর সাথে আসে |

**Environment variable সেট করুন** (Linux/macOS):
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
```

Windows (PowerShell):
```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
```

Android Studio → **SDK Manager** থেকে install করুন:
- Android SDK Platform **34+**
- Android SDK Build-Tools **34+**
- Android SDK Command-line Tools

---

## 🚀 Production-quality APK (Play Store ready)

### ১. Production-only Capacitor config

`capacitor.config.ts` থেকে `server` block টা **comment-out** করুন:

```ts
const config: CapacitorConfig = {
  appId: 'com.hisabnikash24',
  appName: 'হিসাব নিকাশ-২৪',
  webDir: 'dist',
  // server: { url: '...' },   ← এই লাইন comment করুন
  android: { allowMixedContent: true },
};
```

### ২. Signing key তৈরি (একবার)

```bash
keytool -genkey -v -keystore hisabnikash24.keystore \
  -alias hisabnikash24 -keyalg RSA -keysize 2048 -validity 10000
```

পাসওয়ার্ড **সুরক্ষিতভাবে সংরক্ষণ করুন** — হারালে আর কখনো অ্যাপ আপডেট করতে পারবেন না।

### ৩. Bundle তৈরি ও sign

```bash
./scripts/build-android.sh bundle
jarsigner -keystore hisabnikash24.keystore \
  android-output/হিসাব-নিকাশ-২৪-bundle-*.aab hisabnikash24
```

### ৪. Play Console এ আপলোড → publish ✓

---

## 🐛 সাধারণ সমস্যা

| সমস্যা | সমাধান |
|--------|--------|
| `ANDROID_HOME সেট নেই` | উপরের Environment variable অংশ দেখুন |
| `Gradle sync failed` | Android Studio → File → Invalidate Caches → Restart |
| White screen on launch | `npm run build && npx cap sync` চালান |
| `SDK not found` | Android Studio → SDK Manager → SDK 34 ইন্সটল |
| Java version mismatch | JDK 17 ইন্সটল করুন (JDK 21/8 নয়) |

---

## 📱 Native Features (ইতিমধ্যে কনফিগার করা)

- `@capacitor/camera` — ছবি তোলা
- `@capacitor/barcode-scanner` — পণ্যের বারকোড/QR স্ক্যান
- `@capacitor/preferences` — অফলাইন লোকাল স্টোরেজ

Permissions (`AndroidManifest.xml` এ auto-add):
- `CAMERA`, `INTERNET`

---

## 💡 Tip

প্রতিবার code change এর পর:
```bash
./scripts/build-android.sh
```
— এতে build, sync, APK তৈরি — সব একসাথে হবে।
