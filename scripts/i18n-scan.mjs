#!/usr/bin/env node
/**
 * i18n-meetlat: hoeveel hardcoded UI-tekst staat er nog in src/?
 *
 *   node scripts/i18n-scan.mjs                  # heel src/, samengevat per map
 *   node scripts/i18n-scan.mjs src/pages/admin  # één map of bestand
 *   node scripts/i18n-scan.mjs --files          # ook per bestand
 *
 * Categorieën: JSX-tekstnodes, tekstprops (placeholder/title/aria-label/…) en
 * toast-teksten. Het getal is een schatting met een conservatieve negeerlijst;
 * het punt is de trend per batch, niet de laatste eenheid.
 */

import { readFileSync } from 'node:fs';
import { relative, dirname } from 'node:path';
import { ROOT, c, collectTsx, isUiText, TEXT_PROPS, relFromRoot } from './i18n-lib.mjs';

const args = process.argv.slice(2);
const showFiles = args.includes('--files');
const target = args.find((a) => !a.startsWith('--')) ?? 'src';

const propRe = new RegExp(`\\b(${TEXT_PROPS.join('|')})=(?:"([^"\\n]+)"|'([^'\\n]+)')`, 'g');
const jsxTextRe = />\s*([^<>{}\n][^<>{}]*?)\s*</g;
const toastRe = /\b(?:title|description|message)\s*:\s*(?:"([^"\n]+)"|'([^'\n]+)'|`([^`$\n]+)`)/g;

export function scanFile(abs) {
  const src = readFileSync(abs, 'utf8');
  const hits = { jsx: 0, props: 0, toast: 0 };
  for (const m of src.matchAll(jsxTextRe)) if (isUiText(m[1])) hits.jsx++;
  for (const m of src.matchAll(propRe)) if (isUiText(m[2] ?? m[3])) hits.props++;
  for (const m of src.matchAll(toastRe)) if (isUiText(m[1] ?? m[2] ?? m[3])) hits.toast++;
  return { ...hits, total: hits.jsx + hits.props + hits.toast, translated: src.includes('useTranslation') };
}

const files = collectTsx(target);
const perDir = new Map();
const perFile = [];
let totals = { jsx: 0, props: 0, toast: 0, total: 0, files: 0, translated: 0 };

for (const abs of files) {
  const r = scanFile(abs);
  totals.jsx += r.jsx;
  totals.props += r.props;
  totals.toast += r.toast;
  totals.total += r.total;
  totals.files += 1;
  if (r.translated) totals.translated += 1;

  const dir = relative(ROOT, dirname(abs));
  const bucket = perDir.get(dir) ?? { total: 0, files: 0, translated: 0 };
  bucket.total += r.total;
  bucket.files += 1;
  if (r.translated) bucket.translated += 1;
  perDir.set(dir, bucket);
  if (r.total > 0) perFile.push({ file: relFromRoot(abs), ...r });
}

console.log(`\n${c.bold}i18n-scan${c.reset} — ${target}\n`);

const dirs = [...perDir.entries()].sort((a, b) => b[1].total - a[1].total);
for (const [dir, b] of dirs) {
  if (b.total === 0) continue;
  console.log(
    `${String(b.total).padStart(5)} ${c.dim}strings${c.reset}  ${dir} ` +
      `${c.dim}(${b.translated}/${b.files} bestanden met useTranslation)${c.reset}`
  );
}

if (showFiles) {
  console.log('');
  for (const f of perFile.sort((a, b) => b.total - a.total)) {
    console.log(
      `${String(f.total).padStart(5)}  ${f.file} ${c.dim}(jsx ${f.jsx}, props ${f.props}, toast ${f.toast})${c.reset}`
    );
  }
}

console.log(
  `\n${c.bold}Totaal:${c.reset} ${totals.total} hardcoded strings ` +
    `${c.dim}(jsx ${totals.jsx}, props ${totals.props}, toast ${totals.toast})${c.reset} ` +
    `in ${totals.files} bestanden — ${totals.translated} daarvan gebruiken al useTranslation.\n`
);