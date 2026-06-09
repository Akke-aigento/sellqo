#!/usr/bin/env node
/**
 * H4e — Route-coverage scan.
 *
 * Run: `node scripts/verify-route-coverage.mjs`
 *
 * Parseert src/App.tsx, extraheert alle <Route path="...">-entries onder
 * /admin en bepaalt of ze door RouteGuard worden afgedekt.
 * Schrijft naar docs/h4e-route-coverage.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "src", "App.tsx");
const DOCS = path.join(ROOT, "docs");

const src = fs.readFileSync(APP, "utf8");

// We scan line-by-line and pair each `<Route ... path="..."` opening with the
// rest of its element-prop until we see `/>` or the closing `</Route>`.
const srcLines = src.split("\n");
const routes = []; // {path, body}
for (let i = 0; i < srcLines.length; i++) {
  const line = srcLines[i];
  const pathMatch = line.match(/<Route\s+path=["']([^"']+)["']/);
  if (!pathMatch) continue;
  // Collect the body until we hit `/>` or `</Route>` (max 6 lines safety).
  let body = line;
  if (!/\/>|<\/Route>/.test(body)) {
    for (let j = i + 1; j < Math.min(i + 8, srcLines.length); j++) {
      body += "\n" + srcLines[j];
      if (/\/>|<\/Route>/.test(srcLines[j])) break;
    }
  }
  routes.push({ path: pathMatch[1], body });
}

const INTENTIONAL_OPEN = new Set([
  "/admin", // wrapper
  "messages",
  "badges",
  "orders/quotes",
  "orders/quotes/new",
  "orders/quotes/:id",
  "orders/quotes/:id/edit",
  "orders/subscriptions",
  "categories",
  "shipping",
  "promotions/bundles",
  "promotions/volume",
  "promotions/auto",
  "promotions/gifts",
  "promotions/customer-groups",
  "promotions/bogo",
  "promotions/loyalty",
  "promotions/gift-cards",
  "promotions/stacking",
  "marketing/campaigns/:id",
  "pos/:terminalId",
  "pos/terminals/:terminalId",
  "ads/bolcom/campaigns/:id",
  "ads/bolcom/keywords",
  "ads/bolcom/search-terms",
  "help",
  "platform",
  "platform/billing",
  "platform/tenants/:tenantId",
  "platform/coupons",
  "platform/dashboard",
  "platform/feedback",
  "platform/support",
  "platform/changelog",
  "platform/health",
  "platform/legal",
  "platform/docs",
  "platform/field-mappings",
  "platform/payments",
]);

const NOTE_MAP = {
  "/admin": "Wrapper voor sub-routes; auth-check op layout-niveau",
  messages: "Inbox — `inbox` resource via sidebar gating",
  badges: "Badges-pagina open voor alle auth-users",
  categories: "Categorieën open voor alle auth-users (read on products)",
  shipping: "Shipping settings — gating via subpages",
  help: "Help-pagina open voor alle auth-users",
  platform: "Platform-admin only — afgedekt via AdminLayout role-check",
};

const rows = [];
for (const r of routes) {
  const fullPath = r.path;
  if (fullPath !== "/admin" && fullPath.startsWith("/")) continue;
  const guardMatch = r.body.match(/<RouteGuard\s+(require(?:Read|Write))=["']([a-z_]+)["']/);
  const guard = guardMatch ? `${guardMatch[1]}="${guardMatch[2]}"` : null;
  const isIntentional = INTENTIONAL_OPEN.has(fullPath);
  let note;
  if (guard) note = "✅";
  else if (isIntentional) note = NOTE_MAP[fullPath] || "OK — bewust ongated";
  else note = "⚠️ Geen guard — controleer of gating nodig is";
  rows.push({ path: fullPath, guard: guard ?? "(geen)", note });
}

rows.sort((a, b) => a.path.localeCompare(b.path));

const lines = [];
lines.push("# H4e — Route Coverage Scan");
lines.push("");
lines.push(`_Gegenereerd: ${new Date().toISOString()}_`);
lines.push("");
lines.push("| Route | Guard | Notes |");
lines.push("|---|---|---|");
for (const r of rows) lines.push(`| \`${r.path}\` | ${r.guard} | ${r.note} |`);
lines.push("");

const guarded = rows.filter((r) => r.guard !== "(geen)").length;
const unguarded = rows.length - guarded;
const flagged = rows.filter((r) => r.note.startsWith("⚠️")).length;

lines.push("## Samenvatting");
lines.push("");
lines.push(`- **Totaal admin-routes:** ${rows.length}`);
lines.push(`- **Met RouteGuard:** ${guarded}`);
lines.push(`- **Zonder guard (bewust open):** ${unguarded - flagged}`);
lines.push(`- **Zonder guard — ⚠️ controle nodig:** ${flagged}`);
lines.push("");

fs.writeFileSync(path.join(DOCS, "h4e-route-coverage.md"), lines.join("\n"));
console.log(`Route coverage: ${guarded}/${rows.length} guarded, ${flagged} flagged.`);
console.log("→ docs/h4e-route-coverage.md");