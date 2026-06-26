import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hisabnikash24',
  appName: 'হিসাব নিকাশ-২৪',
  webDir: '.output/public',
  server: {
    // Production: live custom domain
    url: 'https://hisabnikas24.top/',
    cleartext: false,
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
