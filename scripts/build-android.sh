#!/usr/bin/env bash
# ============================================================
# হিসাব নিকাশ-২৪ — One-Click Android APK Builder
# ============================================================
# Usage:
#   chmod +x scripts/build-android.sh
#   ./scripts/build-android.sh              # debug APK
#   ./scripts/build-android.sh release      # release (unsigned) APK
#   ./scripts/build-android.sh bundle       # release AAB for Play Store
#
# Requirements (one-time):
#   - Node.js 20+, Java JDK 17, Android Studio + SDK 34+
#   - ANDROID_HOME / ANDROID_SDK_ROOT environment variable set
# ============================================================
set -euo pipefail

MODE="${1:-debug}"
APP_NAME="হিসাব-নিকাশ-২৪"
OUT_DIR="android-output"

cyan()  { printf "\033[1;36m%s\033[0m\n" "$*"; }
green() { printf "\033[1;32m%s\033[0m\n" "$*"; }
red()   { printf "\033[1;31m%s\033[0m\n" "$*" >&2; }

# ---- 0. Sanity checks ----
command -v node    >/dev/null || { red "Node.js পাওয়া যায়নি। https://nodejs.org থেকে ইন্সটল করুন।"; exit 1; }
command -v npx     >/dev/null || { red "npx পাওয়া যায়নি।"; exit 1; }
command -v java    >/dev/null || { red "Java JDK 17 পাওয়া যায়নি।"; exit 1; }
[ -n "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ] || { red "ANDROID_HOME সেট নেই। Android Studio থেকে SDK ইন্সটল করে ENV ভ্যারিয়েবল সেট করুন।"; exit 1; }

cyan "▶ ১/৬  Dependencies ইন্সটল হচ্ছে..."
npm install --silent

cyan "▶ ২/৬  Production build (Vite)..."
# Capacitor production build এর জন্য server block disable করতে হবে।
# capacitor.config.ts তে server block কমেন্ট-আউট করুন অথবা CAPACITOR_NO_DEV_SERVER=1 ব্যবহার করুন।
npm run build

cyan "▶ ৩/৬  Android platform যোগ হচ্ছে (যদি না থাকে)..."
if [ ! -d "android" ]; then
  npx cap add android
fi
npx cap update android

cyan "▶ ৪/৬  Native project এ sync..."
npx cap sync android

cyan "▶ ৫/৬  Gradle দিয়ে APK তৈরি হচ্ছে... (এতে সময় লাগতে পারে)"
cd android

case "$MODE" in
  release)
    ./gradlew assembleRelease
    ARTIFACT="app/build/outputs/apk/release/app-release-unsigned.apk"
    ;;
  bundle)
    ./gradlew bundleRelease
    ARTIFACT="app/build/outputs/bundle/release/app-release.aab"
    ;;
  *)
    ./gradlew assembleDebug
    ARTIFACT="app/build/outputs/apk/debug/app-debug.apk"
    ;;
esac

cd ..

cyan "▶ ৬/৬  Output কপি করা হচ্ছে..."
mkdir -p "$OUT_DIR"
FINAL="$OUT_DIR/${APP_NAME}-${MODE}-$(date +%Y%m%d-%H%M%S).${ARTIFACT##*.}"
cp "android/$ARTIFACT" "$FINAL"

green "✓ সফল! ফাইল: $FINAL"
green ""
green "পরবর্তী ধাপ:"
case "$MODE" in
  release)
    green "  • APK টি sign করতে: apksigner sign --ks <keystore> $FINAL"
    ;;
  bundle)
    green "  • $FINAL Play Console এ আপলোড করুন।"
    ;;
  *)
    green "  • adb install \"$FINAL\"   দিয়ে ফোনে ইন্সটল করুন।"
    ;;
esac
