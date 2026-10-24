// KAART-1 — een geplakte lijst omzetten in kaartlijnen (naam, prijs, categorie).
//
// Wat mensen plakken: "Duvel 4,50", "Duvel - € 4.50", "Duvel\t4,50\tBieren" (Excel/Sheets),
// "Duvel;4,50;Bieren" (csv), en tussenkopjes zoals "Bieren:" of "# Bieren".
// Pure functies, zonder React of Supabase: zo te testen.

export interface KaartLine {
  name: string;
  /** Prijs als "4.50", of null als er geen prijs in de lijn stond. */
  price: string | null;
  /** Categorie uit een tussenkopje of een kolom; null = de gekozen standaardcategorie. */
  category: string | null;
}

const PRICE = /^(?:€\s*)?(\d{1,5})(?:[.,](\d{1,2}))?\s*(?:€|eur|euro)?$/i;

/** "4,5" → "4.50"; "€ 12" → "12.00"; ongeldig → null. */
export function parsePrice(raw: string): string | null {
  const m = PRICE.exec(raw.trim());
  if (!m) return null;
  const cents = (m[2] ?? '').padEnd(2, '0');
  return `${Number(m[1])}.${cents}`;
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s\-–—•*·.:]+|[\s\-–—•*·.:€]+$/g, '').trim();

function isHeader(line: string): string | null {
  const t = line.trim();
  const hash = /^#+\s*(.+)$/.exec(t);
  if (hash) return tidy(hash[1]) || null;
  if (t.endsWith(':') && !/\d/.test(t)) return tidy(t.slice(0, -1)) || null;
  return null;
}

function parseColumns(cols: string[], current: string | null): KaartLine | null {
  const cells = cols.map((c) => c.trim()).filter(Boolean);
  if (!cells.length) return null;
  const priceIdx = cells.findIndex((c, i) => i > 0 && parsePrice(c) !== null);
  const price = priceIdx > 0 ? parsePrice(cells[priceIdx]) : null;
  const rest = cells.filter((_, i) => i !== priceIdx);
  const name = tidy(rest[0] ?? '');
  if (!name) return null;
  const category = rest[1] ? tidy(rest[1]) || current : current;
  return { name, price, category };
}

/** Eén lijn tekst zonder kolommen: de prijs staat achteraan (soms vooraan). */
function parseLoose(line: string, current: string | null): KaartLine | null {
  const t = line.trim();
  // Enkel een prijs zonder naam: geen product.
  if (parsePrice(t) !== null) return null;
  // Prijs achteraan: "Duvel 4,50", "Duvel - € 4.50", "Duvel ....... 4,50 €"
  const back = /^(.*?)[\s.\-–—:|]*(?:€\s*)?(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:€|eur|euro)?$/i.exec(t);
  // "0,0" (alcoholvrij) hoort bij de naam, het is geen prijs.
  if (back && !/^0[.,]0$/.test(back[2])) {
    const name = tidy(back[1]);
    // "33cl" of "0,0" in de naam is geen prijs: er moet een naam overblijven.
    if (name && /[a-zA-ZÀ-ÿ]/.test(name)) return { name, price: parsePrice(back[2]), category: current };
  }
  // Prijs vooraan: "4,50 Duvel", "€4.50 - Duvel"
  const front = /^(?:€\s*)?(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:€|eur|euro)?[\s\-–—:|]+(.+)$/i.exec(t);
  if (front) {
    const name = tidy(front[2]);
    if (name && /[a-zA-ZÀ-ÿ]/.test(name)) return { name, price: parsePrice(front[1]), category: current };
  }
  const name = tidy(t);
  return name ? { name, price: null, category: current } : null;
}

/** Een volledige geplakte tekst → kaartlijnen. Lege lijnen en kopjes geven geen product. */
export function parseKaartText(text: string): KaartLine[] {
  const out: KaartLine[] = [];
  let current: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const header = isHeader(raw);
    if (header) { current = header; continue; }
    const line = raw.includes('\t') ? parseColumns(raw.split('\t'), current)
      : raw.includes(';') ? parseColumns(raw.split(';'), current)
        : parseLoose(raw, current);
    if (line) out.push({ ...line, name: line.name.slice(0, 150) });
  }
  return out;
}

/** Hoofdletter- en spatie-ongevoelige sleutel om dubbels te vinden. */
export const nameKey = (s: string) => s.toLocaleLowerCase('nl').replace(/\s+/g, ' ').trim();

/**
 * Welke lijnen bestaan al (op de kaart of eerder in dezelfde lijst)?
 * Geeft per index 'existing' | 'repeat' | null.
 */
export function findDuplicates(lines: { name: string }[], existingNames: Iterable<string>): ('existing' | 'repeat' | null)[] {
  const existing = new Set([...existingNames].map(nameKey));
  const seen = new Set<string>();
  return lines.map((l) => {
    const k = nameKey(l.name);
    if (existing.has(k)) return 'existing';
    if (seen.has(k)) return 'repeat';
    seen.add(k);
    return null;
  });
}

/** Prijs uit een invoerveld ("4,5", "4.50", "€4") → "4.50" of null. Leeg = null. */
export const priceFromInput = (s: string) => (s.trim() ? parsePrice(s) : null);

/** "4.50" → "4,50" voor in een invoerveld (nl/fr/de) of "4.50" (en). */
export const priceToInput = (value: number | string, lang: string) => {
  const s = Number(value).toFixed(2);
  return lang.startsWith('en') ? s : s.replace('.', ',');
};
