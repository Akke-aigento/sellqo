#!/usr/bin/env node
/**
 * H4e — Static permission-matrix sweep.
 *
 * Run: `node scripts/verify-permissions-matrix.mjs`
 *
 * Scant src/ op alle gating-calls (useCan, PermissionGate, GatedButton,
 * MaskedValue, RouteGuard, sidebar requireRead) en valideert tegen de
 * matrix in src/hooks/useCan.ts. Schrijft rapport naar
 * docs/h4e-static-sweep-report.md en docs/h4e-matrix-coverage.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const DOCS = path.join(ROOT, "docs");

// -------------------- 1. Parse matrix --------------------
const matrixFile = fs.readFileSync(
  path.join(SRC, "hooks", "useCan.ts"),
  "utf8"
);

function parseMatrix(src) {
  const start = src.indexOf("PERMISSION_MATRIX: Matrix = {");
  if (start < 0) throw new Error("PERMISSION_MATRIX not found");
  // Take everything until the matching closing `};` at column 0
  const tail = src.slice(start);
  const endRel = tail.indexOf("\n};");
  const body = tail.slice(0, endRel);
  // Find top-level "resource: { ... },"
  const matrix = {};
  const resourceRe = /^\s{2}(\w+):\s*\{([\s\S]*?)\n\s{2}\},?$/gm;
  let m;
  while ((m = resourceRe.exec(body))) {
    const resource = m[1];
    const inner = m[2];
    const actions = {};
    const actionRe = /(read|write|correct):\s*(\[[^\]]*\]|ALL_ROLES(?:\.filter\([^)]+\))?)/g;
    let a;
    while ((a = actionRe.exec(inner))) {
      const action = a[1];
      const raw = a[2];
      let roles = [];
      if (raw.startsWith("[")) {
        roles = [...raw.matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
      } else {
        // ALL_ROLES (with optional filter)
        const all = [
          "platform_admin",
          "tenant_admin",
          "accountant",
          "staff",
          "warehouse",
          "viewer",
          "marketing",
        ];
        const filterMatch = raw.match(/!==?\s*"([a-z_]+)"/g) || [];
        const excluded = filterMatch.map((s) => s.match(/"([a-z_]+)"/)[1]);
        roles = all.filter((r) => !excluded.includes(r));
      }
      actions[action] = roles;
    }
    matrix[resource] = actions;
  }
  return matrix;
}

const MATRIX = parseMatrix(matrixFile);

// -------------------- 2. Walk src/ --------------------
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) yield full;
  }
}

const findings = {
  useCan: [],
  PermissionGate: [],
  GatedButton: [],
  MaskedValue: [],
  RouteGuard: [],
  sidebarRequireRead: [],
};

const PATTERNS = [
  {
    key: "useCan",
    re: /useCan\(\s*["'](read|write|correct)["']\s*,\s*["']([a-z_]+)["']\s*\)/g,
    cap: (m) => ({ action: m[1], resource: m[2] }),
  },
  {
    key: "PermissionGate",
    re: /<PermissionGate\b[^>]*\baction=["'](read|write|correct)["'][^>]*\bresource=["']([a-z_]+)["']/g,
    cap: (m) => ({ action: m[1], resource: m[2] }),
  },
  {
    key: "GatedButton",
    re: /<GatedButton\b[^>]*\baction=["'](read|write|correct)["'][^>]*\bresource=["']([a-z_]+)["']/g,
    cap: (m) => ({ action: m[1], resource: m[2] }),
  },
  {
    key: "MaskedValue",
    re: /<MaskedValue\b[^>]*\bresource=["']([a-z_]+)["']/g,
    cap: (m) => ({ action: "read", resource: m[1] }),
  },
  {
    key: "RouteGuard",
    re: /<RouteGuard\b[^>]*\b(requireRead|requireWrite)=["']([a-z_]+)["']/g,
    cap: (m) => ({ action: m[1] === "requireRead" ? "read" : "write", resource: m[2] }),
  },
  {
    key: "sidebarRequireRead",
    re: /\brequireRead:\s*["']([a-z_]+)["']/g,
    cap: (m) => ({ action: "read", resource: m[1] }),
  },
];

for (const file of walk(SRC)) {
  const content = fs.readFileSync(file, "utf8");
  for (const { key, re, cap } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
      const { action, resource } = cap(m);
      const line = content.slice(0, m.index).split("\n").length;
      findings[key].push({
        file: path.relative(ROOT, file),
        line,
        action,
        resource,
      });
    }
  }
}

// -------------------- 3. Validate --------------------
const unknown = []; // (resource not in matrix) or (action not defined for resource)
const usedPairs = new Set();
for (const cat of Object.keys(findings)) {
  for (const f of findings[cat]) {
    const def = MATRIX[f.resource];
    if (!def) {
      unknown.push({ ...f, category: cat, reason: "resource ontbreekt in matrix" });
      continue;
    }
    if (!def[f.action]) {
      unknown.push({ ...f, category: cat, reason: `action '${f.action}' niet gedefinieerd voor '${f.resource}'` });
      continue;
    }
    usedPairs.add(`${f.resource}:${f.action}`);
  }
}

const emptyRoles = []; // matrix entries with action => []
for (const [resource, actions] of Object.entries(MATRIX)) {
  for (const [action, roles] of Object.entries(actions)) {
    if (!roles || roles.length === 0) {
      emptyRoles.push({ resource, action });
    }
  }
}

const ungatedResources = []; // matrix resources with NO ui gating at all
for (const resource of Object.keys(MATRIX)) {
  const anyGated = [...usedPairs].some((p) => p.startsWith(`${resource}:`));
  if (!anyGated) ungatedResources.push(resource);
}

// -------------------- 4. Coverage --------------------
const coverageRows = [];
for (const [resource, actions] of Object.entries(MATRIX)) {
  const actionKeys = Object.keys(actions);
  const gated = actionKeys.filter((a) => usedPairs.has(`${resource}:${a}`));
  const points = [...Object.values(findings)]
    .flat()
    .filter((f) => f.resource === resource).length;
  const pct = actionKeys.length === 0 ? 0 : Math.round((gated.length / actionKeys.length) * 100);
  coverageRows.push({
    resource,
    actions: actionKeys.join(", "),
    points,
    coverage: pct,
    gatedActions: gated.join(", ") || "-",
  });
}

// -------------------- 5. Write reports --------------------
const totals = Object.fromEntries(
  Object.entries(findings).map(([k, v]) => [k, v.length])
);
const totalAll = Object.values(totals).reduce((a, b) => a + b, 0);

const sweepReport = [];
sweepReport.push("# H4e — Static Permission Sweep Report");
sweepReport.push("");
sweepReport.push(`_Gegenereerd: ${new Date().toISOString()}_`);
sweepReport.push("");
sweepReport.push("## Totalen per categorie");
sweepReport.push("");
sweepReport.push("| Categorie | Aantal |");
sweepReport.push("|---|---:|");
for (const [k, v] of Object.entries(totals)) sweepReport.push(`| ${k} | ${v} |`);
sweepReport.push(`| **TOTAAL** | **${totalAll}** |`);
sweepReport.push("");

sweepReport.push("## ❌ Onbekende (action, resource) combos — FAIL");
sweepReport.push("");
if (unknown.length === 0) {
  sweepReport.push("_Geen — alle gating-calls verwijzen naar bestaande matrix-entries._");
} else {
  sweepReport.push("| File | Line | Categorie | Action | Resource | Reden |");
  sweepReport.push("|---|---:|---|---|---|---|");
  for (const u of unknown)
    sweepReport.push(`| \`${u.file}\` | ${u.line} | ${u.category} | ${u.action} | ${u.resource} | ${u.reason} |`);
}
sweepReport.push("");

sweepReport.push("## ⚠️ Matrix-resources zonder UI-gating — INFO");
sweepReport.push("");
sweepReport.push("Resources die in de matrix staan maar nergens in de UI worden gegated. Kan bewust zijn (puur RLS) of een ontbrekend gating-point.");
sweepReport.push("");
if (ungatedResources.length === 0) sweepReport.push("_Geen._");
else for (const r of ungatedResources) sweepReport.push(`- \`${r}\``);
sweepReport.push("");

sweepReport.push("## ⚠️ Matrix-entries met 0 toegelaten rollen — WARNING");
sweepReport.push("");
if (emptyRoles.length === 0) sweepReport.push("_Geen._");
else {
  sweepReport.push("| Resource | Action |");
  sweepReport.push("|---|---|");
  for (const e of emptyRoles) sweepReport.push(`| \`${e.resource}\` | ${e.action} |`);
}
sweepReport.push("");

sweepReport.push("## Alle gating-calls (detail)");
sweepReport.push("");
for (const [cat, items] of Object.entries(findings)) {
  sweepReport.push(`### ${cat} (${items.length})`);
  sweepReport.push("");
  if (items.length === 0) { sweepReport.push("_Geen._"); sweepReport.push(""); continue; }
  sweepReport.push("| File | Line | Action | Resource |");
  sweepReport.push("|---|---:|---|---|");
  for (const f of items)
    sweepReport.push(`| \`${f.file}\` | ${f.line} | ${f.action} | ${f.resource} |`);
  sweepReport.push("");
}

fs.writeFileSync(path.join(DOCS, "h4e-static-sweep-report.md"), sweepReport.join("\n"));

const coverageReport = [];
coverageReport.push("# H4e — Matrix-Coverage Report");
coverageReport.push("");
coverageReport.push(`_Gegenereerd: ${new Date().toISOString()}_`);
coverageReport.push("");
coverageReport.push("Coverage% = (#acties met ≥1 UI gating-point) / (#acties in matrix).");
coverageReport.push("");
coverageReport.push("| Resource | Acties in matrix | UI gating-points | Gegated acties | Coverage % |");
coverageReport.push("|---|---|---:|---|---:|");
for (const r of coverageRows)
  coverageReport.push(`| \`${r.resource}\` | ${r.actions} | ${r.points} | ${r.gatedActions} | ${r.coverage}% |`);
coverageReport.push("");

const gaps = coverageRows.filter((r) => r.coverage < 100);
coverageReport.push("## Mogelijke gaten in UI-gating (<100%)");
coverageReport.push("");
if (gaps.length === 0) coverageReport.push("_Geen — alle matrix-acties hebben ≥1 UI gating-point._");
else {
  coverageReport.push("| Resource | Missing acties | Notitie |");
  coverageReport.push("|---|---|---|");
  for (const r of gaps) {
    const all = r.actions.split(", ").filter(Boolean);
    const gated = r.gatedActions === "-" ? [] : r.gatedActions.split(", ");
    const missing = all.filter((a) => !gated.includes(a));
    coverageReport.push(`| \`${r.resource}\` | ${missing.join(", ") || "-"} | ${r.points === 0 ? "geen enkele UI-call" : "deels gegated"} |`);
  }
}
coverageReport.push("");

fs.writeFileSync(path.join(DOCS, "h4e-matrix-coverage.md"), coverageReport.join("\n"));

// -------------------- 6. Console summary --------------------
console.log("=== H4e Static Permission Sweep ===");
console.log("Totals:", totals, "→", totalAll);
console.log("Unknown combos:", unknown.length);
console.log("Matrix entries with 0 roles:", emptyRoles.length);
console.log("Resources without any UI gating:", ungatedResources.length);
console.log("Coverage rows:", coverageRows.length);
console.log("→ docs/h4e-static-sweep-report.md");
console.log("→ docs/h4e-matrix-coverage.md");
if (unknown.length > 0) process.exit(1);