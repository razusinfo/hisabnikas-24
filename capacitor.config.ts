import type { CapacitorConfig } from '@capacitor/cli';

// সত্যিকার Native Android অ্যাপ কনফিগারেশন।
// `server.url` দিলে Capacitor live website সরাসরি WebView-এ খুলে এবং
// connection issue হলে "Webpage not available" দেখায়। তাই এখানে কোনো
// server.url নেই — APK সরাসরি bundled `.output/public/index.html` লোড করবে।
const config: CapacitorConfig = {
  appId: 'com.hisabnikash24',
  appName: 'হিসাব নিকাশ-২৪',
  webDir: '.output/public',
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    BarcodeScanner: {},
    Camera: {},
    GoogleAuth: {
      // Web (server) OAuth Client ID from Google Cloud Console.
      // Replace at build time via VITE_GOOGLE_WEB_CLIENT_ID; the JS side also
      // re-initializes with the same env value at runtime.
      scopes: ["profile", "email"],
      serverClientId: process.env.VITE_GOOGLE_WEB_CLIENT_ID ?? "",
      forceCodeForRefreshToken: false,
    },
  },
};

export default config;
