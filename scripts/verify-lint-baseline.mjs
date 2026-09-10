#!/usr/bin/env node
/**
 * Lint-poortwachter met twee niveaus.
 *
 * Run: `node scripts/verify-lint-baseline.mjs`
 *      `node scripts/verify-lint-baseline.mjs --update`   (baseline herschrijven)
 *
 * Waarom niet gewoon `eslint .` in CI: dat is meteen rood. Deze repo heeft
 * 1.300+ bestaande `no-explicit-any`-fouten, en die in één batch oplossen is
 * geen lintstap maar een refactor. `CLAUDE.md` §6 schrijft daarom voor om tegen
 * een baseline te meten. Dit script doet dat, met één belangrijke uitzondering.
 *
 * NIVEAU 1 — nultolerantie. Een handvol regels mag nooit voorkomen, ongeacht de
 * baseline. `react-hooks/rules-of-hooks` staat er niet voor de netheid in: op
 * 10 september 2026 stonden er negen schendingen in de repo, waarvan één
 * (`BolActionsCard`) een `return null` had gevolgd door vier hooks. In een
 * orderlijst met gemengde marketplace-bronnen draait dezelfde componentpositie
 * dan de ene render nul hooks en de volgende vier — precies waarop React
 * "Rendered more hooks than during the previous render" gooit en het scherm wit
 * wordt. Zulke fouten zijn onzichtbaar tot ze in productie afgaan.
 *
 * NIVEAU 2 — baseline. Het totaal mag niet stijgen. Zakt het, dan meldt het
 * script dat en kun je de baseline verlagen met `--update`. Zo dooft de
 * bestaande schuld uit zonder dat iemand er een project van hoeft te maken.
 *
 * De baseline staat in `.eslint-baseline.json` en hoort in git.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, '.eslint-baseline.json');

/** Regels die nooit mogen voorkomen, hoe hoog de baseline ook staat. */
const ZERO_TOLERANCE = ['react-hooks/rules-of-hooks'];

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
};

const update = process.argv.includes('--update');

// ESLint met de JSON-formatter loopt op de standaardheap uit zijn geheugen op
// deze repo (exit 134). Vandaar de verhoging, en schrijven naar een bestand in
// plaats van door een pipe: de output is enkele MB's.
const outFile = join(mkdtempSync(join(tmpdir(), 'sellqo-lint-')), 'eslint.json');

console.log(`${c.dim}ESLint draait over de hele repo — dit duurt een paar minuten.${c.reset}`);
try {
  execFileSync('npx', ['eslint', '.', '-f', 'json', '-o', outFile], {
    cwd: ROOT,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
} catch {
  // Exit ≠ 0 betekent hier "er zijn bevindingen", niet "de run is mislukt".
  // Een echte crash herkennen we aan een ontbrekend of onleesbaar rapport.
}

if (!existsSync(outFile)) {
  console.error(`${c.red}ESLint heeft geen rapport geschreven.${c.reset} De run is waarschijnlijk gecrasht.\n`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(readFileSync(outFile, 'utf8'));
} catch (err) {
  console.error(`${c.red}Kan het ESLint-rapport niet parsen:${c.reset} ${err.message}\n`);
  process.exit(1);
}

let errors = 0;
let warnings = 0;
const byRule = {};
const zeroHits = [];

for (const file of report) {
  errors += file.errorCount;
  warnings += file.warningCount;
  for (const m of file.messages) {
    const rule = m.ruleId || '(parse)';
    byRule[rule] = (byRule[rule] || 0) + 1;
    if (ZERO_TOLERANCE.includes(rule)) {
      zeroHits.push({
        file: file.filePath.replace(ROOT + '/', ''),
        line: m.line,
        rule,
        message: m.message,
      });
    }
  }
}
const total = errors + warnings;

if (update) {
  writeFileSync(BASELINE, JSON.stringify({ total, errors, warnings, byRule }, null, 2) + '\n');
  console.log(`${c.green}Baseline weggeschreven:${c.reset} ${total} problemen (${errors} errors, ${warnings} warnings).\n`);
  process.exit(0);
}

console.log('');
console.log(`${c.bold}Lint${c.reset} ${c.dim}— ${total} problemen (${errors} errors, ${warnings} warnings)${c.reset}`);

// --- Niveau 1 ---------------------------------------------------------------
if (zeroHits.length > 0) {
  console.log('');
  console.log(`${c.red}${c.bold}Nultolerantie-regel geschonden${c.reset} ${c.dim}(${zeroHits.length})${c.reset}`);
  for (const h of zeroHits) {
    console.log(`  ${c.red}✗${c.reset} ${c.bold}${h.file}:${h.line}${c.reset} ${c.dim}${h.rule}${c.reset}`);
    console.log(`     ${h.message}`);
  }
  console.log('');
  console.log(
    `${c.dim}Een hook die voorwaardelijk draait is geen stijlkwestie: het aantal hooks\n` +
    `moet tussen twee renders gelijk blijven, anders crasht het scherm. Zet de\n` +
    `early return ónder de laatste hook en gate de query met \`enabled\`.${c.reset}\n`
  );
  process.exit(1);
}

// --- Niveau 2 ---------------------------------------------------------------
if (!existsSync(BASELINE)) {
  console.log('');
  console.log(`${c.yellow}Geen baseline gevonden.${c.reset} Maak hem met \`--update\`.\n`);
  process.exit(1);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));

if (total > base.total) {
  const groei = total - base.total;
  const gestegen = Object.entries(byRule)
    .map(([rule, n]) => [rule, n - (base.byRule[rule] || 0)])
    .filter(([, d]) => d > 0)
    .sort((a, b) => b[1] - a[1]);

  console.log('');
  console.log(
    `${c.red}${c.bold}Meer lintproblemen dan de baseline${c.reset} ${c.dim}(${base.total} → ${total}, +${groei})${c.reset}`
  );
  for (const [rule, d] of gestegen) console.log(`  ${c.red}+${d}${c.reset} ${rule}`);
  console.log('');
  console.log(`${c.dim}Los ze op, of — als de groei bewust is — draai \`--update\` en leg in de commit uit waarom.${c.reset}\n`);
  process.exit(1);
}

if (total < base.total) {
  console.log('');
  console.log(
    `${c.green}${c.bold}Beter dan de baseline.${c.reset} ${c.dim}${base.total} → ${total} (${total - base.total}).${c.reset}`
  );
  console.log(`${c.dim}Draai \`node scripts/verify-lint-baseline.mjs --update\` om de lat te verlagen.${c.reset}\n`);
  process.exit(0);
}

console.log(`${c.green}${c.bold}Gelijk aan de baseline.${c.reset} ${c.dim}Geen nieuwe problemen.${c.reset}\n`);
process.exit(0);
