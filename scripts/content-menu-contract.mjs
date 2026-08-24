#!/usr/bin/env node
/**
 * Contractcontrole voor de Dagelijkse Menukaart.
 *
 * De categorie-registry leeft op twee plekken, en dat kan niet anders: een Deno
 * edge-functie kan niet uit `src/` importeren en `src/` niet uit
 * `supabase/functions/`. De frontend bezit de sleutels, de labels en de i18n;
 * de edge-functie bezit de promptinstructie per sleutel.
 *
 * Precies daar kunnen ze uiteen lopen. Voeg je een categorie toe aan één kant
 * en vergeet je de andere, dan slaat de generator dat slot stil over of valt
 * hij terug op een verkeerde instructie — zonder foutmelding.
 *
 * Dit script vergelijkt beide kanten en faalt met exit 1 bij het eerste gat.
 * Controleert ook dat de formaat-nadrukwaarden in de config één-op-één matchen
 * met de CHECK-constraint in de migratie, en dat elke categorie- en
 * formaatsleutel een i18n-key heeft in elke ondersteunde taal.
 *
 * Draaien met: node scripts/content-menu-contract.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
};

const problems = [];

function read(relative) {
  try {
    return readFileSync(join(ROOT, relative), 'utf8');
  } catch (err) {
    console.error(`${c.red}Kan ${relative} niet lezen:${c.reset} ${err.message}`);
    process.exit(1);
  }
}

// --- 1. Categoriesleutels aan beide kanten -----------------------------------

const configSrc = read('src/config/contentMenuCategories.ts');
const sharedSrc = read('supabase/functions/_shared/contentCategories.ts');

const configKeys = [...configSrc.matchAll(/^\s{4}key: '([a-z_]+)',$/gm)].map((m) => m[1]);
const sharedKeys = [...sharedSrc.matchAll(/^\s{4}key: "([a-z_]+)",$/gm)].map((m) => m[1]);

if (configKeys.length === 0) problems.push('Geen categorie-keys gevonden in src/config/contentMenuCategories.ts');
if (sharedKeys.length === 0) problems.push('Geen categorie-keys gevonden in supabase/functions/_shared/contentCategories.ts');

const onlyInConfig = configKeys.filter((k) => !sharedKeys.includes(k));
const onlyInShared = sharedKeys.filter((k) => !configKeys.includes(k));

if (onlyInConfig.length) {
  problems.push(`Alleen in de frontend-config, geen promptinstructie: ${onlyInConfig.join(', ')}`);
}
if (onlyInShared.length) {
  problems.push(`Alleen in de edge-functie, niet in de frontend-config: ${onlyInShared.join(', ')}`);
}

// --- 2. Formaat-nadruk: config tegen de CHECK-constraint ---------------------

const migrationSrc = read('supabase/migrations/20260820100000_menu1_brand_dna.sql');
const checkMatch = migrationSrc.match(/format_emphasis IN \(([^)]*)\)/);
const sqlFormats = checkMatch
  ? checkMatch[1].split(',').map((v) => v.trim().replace(/^'|'$/g, ''))
  : [];

const configFormatsMatch = configSrc.match(/FORMAT_EMPHASIS_VALUES = \[([\s\S]*?)\] as const/);
const configFormats = configFormatsMatch
  ? [...configFormatsMatch[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1])
  : [];

if (JSON.stringify(sqlFormats) !== JSON.stringify(configFormats)) {
  problems.push(
    `format_emphasis loopt uiteen — CHECK: [${sqlFormats.join(', ')}] vs config: [${configFormats.join(', ')}]`,
  );
}

// --- 3. Kaartformaten aan beide kanten ---------------------------------------

const sharedCardFormats = (sharedSrc.match(/CARD_FORMATS = \[([^\]]*)\]/) || [, ''])[1]
  .split(',')
  .map((v) => v.trim().replace(/^"|"$/g, ''))
  .filter(Boolean);

const typesSrc = read('src/types/daily-menu.ts');
const frontendCardFormats = (typesSrc.match(/CARD_FORMATS = \[([^\]]*)\]/) || [, ''])[1]
  .split(',')
  .map((v) => v.trim().replace(/^'|'$/g, ''))
  .filter(Boolean);

if (JSON.stringify(sharedCardFormats) !== JSON.stringify(frontendCardFormats)) {
  problems.push(
    `CARD_FORMATS loopt uiteen — edge: [${sharedCardFormats.join(', ')}] vs frontend: [${frontendCardFormats.join(', ')}]`,
  );
}

// --- 4. i18n-dekking in elke ondersteunde taal -------------------------------

const LOCALES_DIR = join(ROOT, 'src', 'i18n', 'locales');
const langs = readdirSync(LOCALES_DIR)
  .filter((f) => /^[a-z]{2}\.json$/.test(f))
  .map((f) => f.replace('.json', ''));

function lookup(tree, path) {
  return path.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), tree);
}

for (const lang of langs) {
  const tree = JSON.parse(readFileSync(join(LOCALES_DIR, `${lang}.json`), 'utf8'));
  const expected = [
    ...configKeys.flatMap((k) => [
      `content_menu.categories.${k}.label`,
      `content_menu.categories.${k}.description`,
    ]),
    ...configFormats.flatMap((f) => [
      `content_menu.format_emphasis.${f}.label`,
      `content_menu.format_emphasis.${f}.description`,
    ]),
    ...frontendCardFormats.map((f) => `content_menu.today.formats.${f}`),
  ];
  const missing = expected.filter((key) => lookup(tree, key) === undefined);
  if (missing.length) {
    problems.push(`${lang}: ${missing.length} ontbrekende key(s) — ${missing.slice(0, 5).join(', ')}`);
  }
}

// --- Uitkomst ----------------------------------------------------------------

console.log(`\n${c.bold}content-menu-contract${c.reset} — ${configKeys.length} categorieën, ${configFormats.length} formaat-nadrukken, ${frontendCardFormats.length} kaartformaten, ${langs.length} talen\n`);

if (problems.length) {
  for (const problem of problems) console.log(`${c.red}✗${c.reset} ${problem}`);
  console.log(`\n${c.red}${c.bold}${problems.length} probleem/problemen.${c.reset}\n`);
  process.exit(1);
}

console.log(`${c.green}✓${c.reset} categorie-keys identiek aan beide kanten: ${c.dim}${configKeys.join(', ')}${c.reset}`);
console.log(`${c.green}✓${c.reset} format_emphasis gelijk aan de CHECK-constraint`);
console.log(`${c.green}✓${c.reset} CARD_FORMATS gelijk aan beide kanten`);
console.log(`${c.green}✓${c.reset} i18n-dekking compleet in ${langs.join(', ')}`);
console.log(`\n${c.green}${c.bold}Contract klopt.${c.reset}\n`);
