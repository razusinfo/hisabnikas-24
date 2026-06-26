import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hisabnikash24',
  appName: 'হিসাব নিকাশ-২৪',
  webDir: '.output/public',
  // IMPORTANT: কোন `server.url` দেওয়া যাবে না — দিলে অ্যাপ ব্রাউজারের মত
  // লাইভ সাইট লোড করে (WebView wrapper)। Production APK তে অ্যাপ নিজের
  // bundled `.output/public` থেকে চলবে — এটাই আসল native অ্যাপ অভিজ্ঞতা।
  // লোকাল dev এ লাইভ-রিলোড দরকার হলে শুধু তখনই নিচে server.url যোগ করবেন,
  // APK build এর আগে আবার সরিয়ে ফেলবেন।
  android: {
    allowMixedContent: true,
  },
  plugins: {
    BarcodeScanner: {
      // Camera permission rationale shown to user
    },
    Camera: {
      // Permissions handled automatically
    },
  },
};

export default config;
