/// <reference types="@capacitor/keyboard" />
/// <reference types="@capacitor/status-bar" />
// KASSA-0 — tweede app-target in dezelfde repo, zelfde Supabase-backend als de admin.
// Native projecten (android/, ios/) worden pas aangemaakt in de app-batch (App Store/Play),
// met `npx cap add` vanuit deze map. Tot dan bouwt enkel de webcode: npm run build:kassa.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.sellqo.kassa',
  appName: 'SellQo Kassa',
  webDir: '../../dist-kassa',
  plugins: {
    Keyboard: { resize: 'native', resizeOnFullScreen: true },
    StatusBar: { style: 'DEFAULT' },
  },
};

export default config;
