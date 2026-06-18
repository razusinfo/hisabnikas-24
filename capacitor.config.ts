import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hisabnikash24',
  appName: 'হিসাব নিকাশ-২৪',
  webDir: 'dist',
  server: {
    // Lovable sandbox preview URL — hot-reload for development.
    // Production build এর জন্য এই server block টা remove করে দিতে হবে।
    url: 'https://cde7a6bb-d29f-4273-9f97-998bad84e306.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
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
