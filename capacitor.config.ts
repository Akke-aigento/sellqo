/// <reference types="@capacitor/keyboard" />
/// <reference types="@capacitor/status-bar" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.sellqo.admin',
  appName: 'SellQo Admin',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      // iOS-only. 'native' is ook de Capacitor-default; expliciet vastgelegd
      // omdat de WebView dan meekrimpt met het toetsenbord — fixed elementen
      // blijven daardoor binnen beeld in plaats van eronder te verdwijnen.
      //
      // APP-KEYBOARD-1 (22 sep 2026): dat was óók het probleem. De zwevende
      // navigatiepil bleef zo boven het toetsenbord hangen, midden in beeld.
      // Wat er moet wijken, bepaalt nu de app zelf via useKeyboardInset
      // (src/hooks/useKeyboardInset.ts), die hier op de plugin-events leunt.
      resize: 'native',
      // Android-only. Onder de afgedwongen edge-to-edge van targetSdk 36 telt
      // de app als fullscreen en resizet de WebView niet vanzelf bij het
      // openen van het toetsenbord; deze vlag zet die workaround aan.
      resizeOnFullScreen: true,
    },
    StatusBar: {
      // Volgt de verschijning van het toestel (licht/donker).
      //
      // overlaysWebView staat hier bewust NIET: vanaf Android 16 (targetSdk 36)
      // negeert het systeem die optie, en op iOS zou hij de WebView onder de
      // statusbar vandaan halen — waarmee env(safe-area-inset-top) daar 0 wordt
      // en --safe-top/pt-safe dood valt terwijl het op Android live blijft.
      // De edge-to-edge + safe-area-aanpak uit index.css blijft dus leidend.
      style: 'DEFAULT',
    },
  },
};

export default config;
