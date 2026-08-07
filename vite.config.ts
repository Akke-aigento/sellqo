import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Native Capacitor plugin ships a web fallback that imports
      // firebase/messaging. The web build never runs that code (native-only
      // guard in src/native/pushRegistration.ts), so we alias it to a stub
      // to avoid pulling the Firebase JS SDK into the browser bundle.
      "firebase/messaging": path.resolve(
        __dirname,
        "./src/native/firebase-messaging-stub.ts",
      ),
    },
  },
}));
