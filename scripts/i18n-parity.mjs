#!/usr/bin/env node
/**
 * i18n-pariteitscontrole voor de SellQo core.
 *
 * Controleert dat elke ondersteunde taal exact dezelfde key-set heeft. Dat is
 * hier geen cosmetische wens: i18n draait met fallbackLng: 'nl', dus een key die
 * in en.json ontbreekt levert geen nette Engelse fallback op maar een zichtbare
 * Nederlandse brok in een verder Engels scherm.
 *
 * Werkwijze:
 *   - leidt de talen af uit de aanwezige bestanden in src/i18n/locales/
 *     ({code}.json en landing.{code}.json)
 *   - voegt per taal beide bestanden samen zoals src/i18n/index.ts dat doet
 *     ({ ...app, ...landing }) en plat de boom tot dot-notation keys
 *   - vergelijkt elke taal met de unie van alle keys
 *
 * Exit 0 bij volledige pariteit, exit 1 bij enig gat.
 *
 * Geen dependencies — draaien met: node scripts/i18n-parity.mjs
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCALES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');

/** Hoeveel ontbrekende keys we per taal maximaal uitschrijven. */
const MAX_LISTED = 40;

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

/** Plat een geneste vertaalboom tot dot-notation keys. Arrays gelden als blad. */
function flatten(node, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.add(path);
    }
  }
  return out;
}

function readJson(file) {
  const full = join(LOCALES_DIR, file);
  try {
    return JSON.parse(readFileSync(full, 'utf8'));
  } catch (err) {
    console.error(`${c.red}Kan ${file} niet lezen of parsen:${c.reset} ${err.message}`);
    process.exit(1);
  }
}

// --- Talen afleiden uit de aanwezige bestanden -------------------------------

let files;
try {
  files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
} catch (err) {
  console.error(`${c.red}Kan ${LOCALES_DIR} niet lezen:${c.reset} ${err.message}`);
  process.exit(1);
}

/** code -> { app: string|null, landing: string|null } */
const byLang = new Map();
const ensure = (code) => {
  if (!byLang.has(code)) byLang.set(code, { app: null, landing: null });
  return byLang.get(code);
};

for (const file of files) {
  const landing = file.match(/^landing\.([a-z]{2})\.json$/);
  if (landing) {
    ensure(landing[1]).landing = file;
    continue;
  }
  const app = file.match(/^([a-z]{2})\.json$/);
  if (app) ensure(app[1]).app = file;
}

const langs = [...byLang.keys()].sort();

if (langs.length === 0) {
  console.error(`${c.red}Geen locale-bestanden gevonden in ${LOCALES_DIR}.${c.reset}`);
  process.exit(1);
}

// --- Key-sets opbouwen -------------------------------------------------------

/** code -> Set van keys */
const keysByLang = new Map();
const union = new Set();
let incompletePairs = 0;

for (const code of langs) {
  const { app, landing } = byLang.get(code);
  if (!app || !landing) {
    incompletePairs++;
    console.log(
      `${c.yellow}!${c.reset} ${c.bold}${code}${c.reset} mist ${
        app ? `landing.${code}.json` : `${code}.json`
      } ${c.dim}(alleen het aanwezige bestand wordt vergeleken)${c.reset}`
    );
  }

  // Zelfde samenvoeging als src/i18n/index.ts: landing overschrijft app.
  const merged = { ...(app ? readJson(app) : {}), ...(landing ? readJson(landing) : {}) };
  const keys = flatten(merged);
  keysByLang.set(code, keys);
  for (const k of keys) union.add(k);
}

// --- Rapporteren -------------------------------------------------------------

console.log(
  `\n${c.bold}i18n-pariteit${c.reset} — ${langs.length} ${
    langs.length === 1 ? 'taal' : 'talen'
  } (${langs.join(', ')}), ${union.size} unieke keys in de unie\n`
);

let gaps = 0;

for (const code of langs) {
  const keys = keysByLang.get(code);
  const missing = [...union].filter((k) => !keys.has(k)).sort();

  if (missing.length === 0) {
    console.log(`${c.green}✓${c.reset} ${c.bold}${code}${c.reset}  ${keys.size}/${union.size} keys`);
    continue;
  }

  gaps += missing.length;
  const pct = ((keys.size / union.size) * 100).toFixed(1);
  console.log(
    `${c.red}✗${c.reset} ${c.bold}${code}${c.reset}  ${keys.size}/${union.size} keys ` +
      `${c.dim}(${pct}%)${c.reset} — ${c.red}${missing.length} ontbrekend${c.reset}`
  );
  for (const key of missing.slice(0, MAX_LISTED)) {
    console.log(`    ${c.dim}·${c.reset} ${key}`);
  }
  if (missing.length > MAX_LISTED) {
    console.log(`    ${c.dim}… en nog ${missing.length - MAX_LISTED} andere${c.reset}`);
  }
}

console.log('');

if (incompletePairs > 0) {
  console.log(
    `${c.yellow}Let op:${c.reset} ${incompletePairs} ${
      incompletePairs === 1 ? 'taal heeft' : 'talen hebben'
    } geen compleet bestandenpaar ({code}.json + landing.{code}.json).`
  );
}

if (gaps > 0) {
  console.log(
    `${c.red}${c.bold}Pariteit niet gehaald:${c.reset} ${gaps} ontbrekende ${
      gaps === 1 ? 'key' : 'keys'
    } in totaal.`
  );
  console.log(
    `${c.dim}Vul de ontbrekende keys aan in de betreffende locale-bestanden — met een echte vertaling, geen NL-kopie.${c.reset}\n`
  );
  process.exit(1);
}

console.log(`${c.green}${c.bold}Volledige pariteit.${c.reset} Elke taal heeft dezelfde key-set.\n`);
process.exit(0);
