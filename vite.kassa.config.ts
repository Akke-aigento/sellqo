// KASSA-0 — build van het tweede app-target "SellQo Kassa" (app.sellqo.kassa).
// Eigen ingang (src/kassa/app/index.html) en eigen uitvoermap (dist-kassa), zodat de admin-
// build (vite.config.ts → dist) er niets van merkt. Capacitor-config: apps/kassa/.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/kassa/app'),
  publicDir: false,
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'firebase/messaging': path.resolve(__dirname, './src/native/firebase-messaging-stub.ts'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-kassa'),
    emptyOutDir: true,
  },
  server: { host: '::', port: 8081 },
});
