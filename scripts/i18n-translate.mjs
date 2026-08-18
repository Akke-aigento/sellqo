#!/usr/bin/env node
/**
 * i18n-vertaalmotor: vult ontbrekende keys in alle talen aan vanuit het Nederlands.
 *
 *   node scripts/i18n-translate.mjs                 # alle talen bijwerken
 *   node scripts/i18n-translate.mjs --lang fr,de    # alleen deze talen
 *   node scripts/i18n-translate.mjs --lang es --new  # volledig nieuwe taal
 *   node scripts/i18n-translate.mjs --dry           # alleen tonen wat er zou gebeuren
 *
 * Vertaalt in blokken van ~100 keys via de Lovable AI-gateway, met een glossary
 * zodat vaktermen consistent blijven met de bestaande keys. Interpolatie
 * ({{count}}) en eenvoudige HTML blijven intact; blokken waar dat misgaat worden
 * geweigerd en opnieuw geprobeerd, en anders overgeslagen (nooit half werk
 * wegschrijven).
 *
 * Bestaande waarden worden NOOIT overschreven — puur additief.
 */

import { c, readLangCodes, readLocale, writeLocale, flattenTree, getKey, setKey, DEFAULT_LANG } from './i18n-lib.mjs';

const API = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-3-flash';
const CHUNK = 100;
const MAX_ATTEMPTS = 3;

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const langArg = args.find((a) => a.startsWith('--lang'));
const explicit = langArg ? (langArg.includes('=') ? langArg.split('=')[1] : args[args.indexOf(langArg) + 1]) : null;

const apiKey = process.env.LOVABLE_API_KEY;
if (!apiKey && !dry) {
  console.error(`${c.red}LOVABLE_API_KEY ontbreekt in de omgeving.${c.reset}`);
  process.exit(1);
}

const LANG_NAMES = {
  nl: 'Dutch (Netherlands/Belgium)', en: 'English', fr: 'French', de: 'German',
  uk: 'Ukrainian', es: 'Spanish', it: 'Italian', pt: 'Portuguese', pl: 'Polish',
};

/** Vaktermen die consistent moeten blijven met de bestaande 2000+ keys. */
const GLOSSARY = `
btw            -> en: VAT | fr: TVA | de: MwSt. | uk: ПДВ
bestelling     -> en: order | fr: commande | de: Bestellung | uk: замовлення
factuur        -> en: invoice | fr: facture | de: Rechnung | uk: рахунок
creditnota     -> en: credit note | fr: note de crédit | de: Gutschrift | uk: кредит-нота
retour         -> en: return | fr: retour | de: Rücksendung | uk: повернення
voorraad       -> en: stock | fr: stock | de: Lagerbestand | uk: запас
verzendmethode -> en: shipping method | fr: méthode d'expédition | de: Versandart | uk: спосіб доставки
machtiging     -> en: mandate | fr: mandat | de: Mandat | uk: мандат
abonnement     -> en: subscription | fr: abonnement | de: Abonnement | uk: підписка
webshop        -> en: webshop | fr: boutique en ligne | de: Webshop | uk: онлайн-магазин
klant          -> en: customer | fr: client | de: Kunde | uk: клієнт
teamlid        -> en: team member | fr: membre de l'équipe | de: Teammitglied | uk: учасник команди
korting        -> en: discount | fr: remise | de: Rabatt | uk: знижка
levering       -> en: delivery | fr: livraison | de: Lieferung | uk: доставка
`.trim();

const SYSTEM = `You translate UI strings for SellQo, a multi-tenant e-commerce SaaS admin panel and webshop.

Rules:
- Translate from Dutch into the requested target language.
- Keep the tone of a professional SaaS product: concise, second person, no marketing fluff.
- Preserve EXACTLY, character for character: i18next interpolation ({{count}}, {{name}}), HTML tags, markdown, leading/trailing whitespace, punctuation style and trailing colons/ellipses.
- Do NOT translate brand names: SellQo, Stripe, Bol.com, Amazon, Shopify, WooCommerce, Odoo, Peppol, Mollie, Klarna, Bancontact, iDEAL, SEPA, Printful, PostNL, bpost, DHL, DPD, GLS, UPS, Exact Online, Octopus, WhatsApp, Meta.
- Keep well-known abbreviations that stay identical in the target language (SKU, EAN, IBAN, PDF, CSV, QR, API, POS, AI).
- Never return the Dutch source text unchanged unless it is genuinely identical in the target language (e.g. a single brand or abbreviation).
- Return ONLY a JSON object mapping every input key to its translation. No prose, no code fences.

Glossary (use these terms consistently):
${GLOSSARY}`;

function placeholders(text) {
  return [...String(text).matchAll(/\{\{[^}]+\}\}/g)].map((m) => m[0]).sort();
}

async function translateChunk(entries, lang) {
  const payload = Object.fromEntries(entries);
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Target language: ${LANG_NAMES[lang] ?? lang} (${lang}).\nTranslate every value of this JSON object:\n\n${JSON.stringify(payload, null, 1)}`,
      },
    ],
    response_format: { type: 'json_object' },
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get('retry-after') ?? 0) * 1000 || attempt * 4000;
      console.log(`${c.yellow}  ${res.status} — ${Math.round(wait / 1000)}s wachten (poging ${attempt}/${MAX_ATTEMPTS})${c.reset}`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (res.status === 402 || res.status === 403) {
      console.error(`${c.red}AI-gateway weigert (${res.status}): ${await res.text()}${c.reset}`);
      process.exit(2);
    }
    if (!res.ok) {
      console.error(`${c.red}AI-gateway fout ${res.status}: ${(await res.text()).slice(0, 300)}${c.reset}`);
      return null;
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '';
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch {
      console.log(`${c.yellow}  onparseerbaar antwoord, opnieuw (poging ${attempt}/${MAX_ATTEMPTS})${c.reset}`);
      continue;
    }

    // Validatie: alle keys aanwezig, interpolatie intact.
    const out = {};
    let bad = 0;
    for (const [key, nlValue] of entries) {
      const value = parsed[key];
      if (typeof value !== 'string' || value.trim() === '') { bad++; continue; }
      if (placeholders(value).join('|') !== placeholders(nlValue).join('|')) { bad++; continue; }
      out[key] = value;
    }
    if (bad > 0 && attempt < MAX_ATTEMPTS) {
      console.log(`${c.yellow}  ${bad} key(s) ongeldig, blok opnieuw (poging ${attempt}/${MAX_ATTEMPTS})${c.reset}`);
      continue;
    }
    if (bad > 0) console.log(`${c.yellow}  ${bad} key(s) overgeslagen na ${MAX_ATTEMPTS} pogingen${c.reset}`);
    return out;
  }
  return null;
}

const allLangs = readLangCodes();
const targets = (explicit ? explicit.split(',').map((s) => s.trim()) : allLangs).filter((l) => l !== DEFAULT_LANG);

const nl = readLocale('nl');
const flatNl = [...flattenTree(nl)].filter(([, v]) => typeof v === 'string');

console.log(`\n${c.bold}i18n-translate${c.reset} — bron nl (${flatNl.length} keys), doel: ${targets.join(', ')}\n`);

for (const lang of targets) {
  let tree;
  try {
    tree = readLocale(lang);
  } catch {
    console.log(`${c.yellow}${lang}.json bestaat nog niet — wordt aangemaakt.${c.reset}`);
    tree = {};
  }

  const missing = flatNl.filter(([key]) => getKey(tree, key) === undefined);
  if (missing.length === 0) {
    console.log(`${c.green}✓${c.reset} ${c.bold}${lang}${c.reset} volledig — niets te doen`);
    continue;
  }

  console.log(`${c.bold}${lang}${c.reset} — ${missing.length} ontbrekende keys in ${Math.ceil(missing.length / CHUNK)} blok(ken)`);
  if (dry) continue;

  let written = 0;
  for (let i = 0; i < missing.length; i += CHUNK) {
    const chunk = missing.slice(i, i + CHUNK);
    const result = await translateChunk(chunk, lang);
    if (!result) { console.log(`${c.red}  blok ${i / CHUNK + 1} mislukt — overgeslagen${c.reset}`); continue; }
    for (const [key, value] of Object.entries(result)) if (setKey(tree, key, value)) written++;
    writeLocale(lang, tree); // per blok wegschrijven: een afgebroken run verliest niets
    console.log(`  ${c.dim}blok ${Math.floor(i / CHUNK) + 1}/${Math.ceil(missing.length / CHUNK)} → ${written} keys totaal${c.reset}`);
  }
  console.log(`${c.green}✓${c.reset} ${lang}: ${written} keys toegevoegd`);
}

console.log(`\nControle: ${c.cyan}npm run i18n:check${c.reset}\n`);