/**
 * Vult ontbrekende vertalingen uit het vertaalgeheugen van de repo zelf.
 *
 * Veel nieuwe keys hebben een NL-waarde die elders al vertaald is ("Annuleren",
 * "Opslaan", "Geen resultaten"). Voor die waarden hoeft niets bedacht te worden:
 * neem de bestaande vertaling over. Alleen 1-op-1-gevallen worden overgenomen —
 * heeft dezelfde NL-tekst in verschillende talen verschillende vertalingen, dan
 * is de context blijkbaar niet gelijk en blijft de key open.
 *
 * Strikt additief: bestaande waarden worden nooit overschreven.
 *
 * Gebruik: node scripts/i18n-translate-memory.mjs [--dry]
 */

import { c, readLangCodes, readLocale, writeLocale, flattenTree, setKey, getKey, DEFAULT_LANG } from './i18n-lib.mjs';

const dry = process.argv.includes('--dry');
const langs = readLangCodes().filter((l) => l !== DEFAULT_LANG);
const nl = readLocale(DEFAULT_LANG);
const nlFlat = flattenTree(nl);

for (const lang of langs) {
  const tree = readLocale(lang);
  const flat = flattenTree(tree);

  // geheugen: NL-waarde -> set van vertalingen die er al voor bestaan
  const memory = new Map();
  for (const [key, nlValue] of nlFlat) {
    if (typeof nlValue !== 'string') continue;
    const translated = flat.get(key);
    if (typeof translated !== 'string' || !translated) continue;
    if (!memory.has(nlValue)) memory.set(nlValue, new Set());
    memory.get(nlValue).add(translated);
  }

  let filled = 0, ambiguous = 0, open = 0;
  for (const [key, nlValue] of nlFlat) {
    if (typeof nlValue !== 'string') continue;
    if (getKey(tree, key) !== undefined) continue;
    const options = memory.get(nlValue);
    if (!options) { open++; continue; }
    if (options.size > 1) { ambiguous++; continue; }
    setKey(tree, key, [...options][0]);
    filled++;
  }
  if (!dry) writeLocale(lang, tree);
  console.log(`${c.bold}${lang}${c.reset} — ${c.green}${filled}${c.reset} uit geheugen, ` +
    `${ambiguous} dubbelzinnig overgeslagen, ${open} nog open${dry ? ` ${c.yellow}(dry-run)${c.reset}` : ''}`);
}
