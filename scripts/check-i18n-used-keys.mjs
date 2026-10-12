#!/usr/bin/env node
/**
 * I18N-FIX-1 — poortwachter op t('…')-keys die niet in nl.json bestaan.
 *
 * Run: `node scripts/check-i18n-used-keys.mjs`
 *
 * Aanleiding: op 13 oktober 2026 toonde de productimport letterlijk
 * "import.drop_or_click", "import.supported_formats" enz.: de code vroeg keys op
 * die in geen enkele taal bestonden. i18n-parity.mjs zag dat niet, want die
 * vergelijkt alleen de talen onderling, niet met wat de code gebruikt.
 *
 * Telt alleen letterlijke keys met een punt, zonder terugvaltekst
 * (t('a.b', 'Tekst') toont de tekst en is dus geen kaal key-pad). Een key
 * telt als aanwezig als hij, of zijn _one/_other-variant, in nl.json of
 * landing.nl.json staat (die twee worden in src/i18n/index.ts samengevoegd).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = join(ROOT, 'src/i18n/locales');
const nl = {
  ...JSON.parse(readFileSync(join(LOCALES, 'nl.json'), 'utf8')),
  ...JSON.parse(readFileSync(join(LOCALES, 'landing.nl.json'), 'utf8')),
};

function has(key) {
  let d = nl;
  for (const part of key.split('.')) {
    if (d && typeof d === 'object' && part in d) d = d[part];
    else return false;
  }
  return true;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

// t('key') of t('key', { … }) — maar niet t('key', 'terugval').
const RE = /\bt\(\s*['"]([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+)['"]\s*(,\s*(['"`]))?/g;
const missing = [];
for (const file of walk(join(ROOT, 'src'))) {
  const src = readFileSync(file, 'utf8');
  let m;
  while ((m = RE.exec(src))) {
    if (m[3]) continue; // terugvaltekst aanwezig
    const key = m[1];
    if (has(key) || has(`${key}_one`) || has(`${key}_other`)) continue;
    const line = src.slice(0, m.index).split('\n').length;
    missing.push(`${relative(ROOT, file)}:${line}  ${key}`);
  }
}

if (missing.length) {
  console.log(`\x1b[31m\x1b[1m${missing.length} vertaalkey(s) zonder tekst in nl.json:\x1b[0m`);
  for (const l of missing) console.log(`  ${l}`);
  console.log('\nVoeg de key toe in alle talen (zie scripts/i18n-parity.mjs), of geef een terugvaltekst mee.');
  process.exit(1);
}
console.log('\x1b[32mAlle gebruikte vertaalkeys bestaan.\x1b[0m');
