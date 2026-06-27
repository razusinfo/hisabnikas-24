import type { CapacitorConfig } from '@capacitor/cli';

// সত্যিকার Native Android অ্যাপ কনফিগারেশন।
// `server.url` দেওয়া হলে Capacitor live website সরাসরি WebView এ লোড করে —
// সেটা ব্রাউজার-এর মত অনুভব হয়। তাই এখানে আমরা bundled `index.html` ব্যবহার করছি,
// যেটা GitHub Actions build-এ তৈরি হয় এবং পুরো অ্যাপটিকে fullscreen WebView shell-এর
// মত কাজ করায় — কোনো address bar বা URL field দেখাবে না।
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
  },
};

export default config;
