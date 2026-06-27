import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hisabnikash24',
  appName: 'হিসাব নিকাশ-২৪',
  webDir: '.output/public',
  // TanStack Start (SSR) প্রজেক্ট — `.output/public` তে static `index.html` থাকে না।
  // তাই Capacitor কে live custom domain লোড করতে বলা হচ্ছে। এতে মোবাইল অ্যাপে
  // সাদা স্ক্রিন বা "Webpage not available" আসবে না।
  server: {
    url: 'https://hisabnikas24.top/',
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    BarcodeScanner: {},
    Camera: {},
  },
};

export default config;
