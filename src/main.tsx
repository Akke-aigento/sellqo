import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./i18n"; // Initialize i18n
import { loadAkkeInsights } from "./lib/akkeInsights";
import { installGlobalErrorHandlers } from "./lib/clientErrors";
import { RootErrorBoundary } from "./components/AppErrorBoundary";

loadAkkeInsights();
// HORECA-0 — verouderde JS-stukken na een deploy één keer herladen; fouten loggen.
installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </HelmetProvider>
);
