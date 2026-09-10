import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // `dist` is de webbuild. De rest is gegenereerd door `npx cap sync` en door
    // Gradle: de webassets worden naar beide native projecten gekopieerd, en
    // android/app/build bevat build-intermediates. Die zijn geen bron en horen
    // niet gelint te worden — ze zorgden er bovendien voor dat het lint-totaal
    // lokaal 3 hoger uitviel dan in CI, puur omdat hier ooit een Android-build
    // is gedraaid en op een verse runner niet. Een baseline die per machine
    // verschilt, bewaakt niets.
    ignores: [
      "dist",
      "android/app/build",
      "android/app/src/main/assets/public",
      "ios/App/App/public",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
