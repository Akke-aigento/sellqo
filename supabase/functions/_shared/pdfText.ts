// UX-POLISH-1 (bevinding C) — gedeelde wrap-helper voor PDF-kolommen.
// pdf-lib heeft geen tekstwrap; zonder deze helper werden omschrijvingen
// afgekapt (substring) in factuur- en creditnota-PDF's.
//
// PDF-EMOJI-1 — gedeelde tekst-sanitiser voor ALLE PDF-generatoren.
// De standaardfonts van pdf-lib (Helvetica e.a.) kennen enkel WinAnsi
// (cp1252, 218 tekens). Eén emoji, Cyrillische klantnaam of CJK-teken in
// een productnaam liet `encodeText`/`widthOfTextAtSize` gooien
// ("WinAnsi cannot encode ...") en de hele PDF faalde.
// Gebruik: `hardenPdfFont(await pdfDoc.embedFont(StandardFonts.Helvetica))`
// direct na elke embedFont. Daarna kan geen enkele drawText- of
// breedteberekening op dat font nog op tekst crashen, ook nieuwe niet.
// Puur TypeScript zonder Deno-API's: ook `src/utils/packingSlipPdf.ts` gebruikt het.

/** WinAnsi (cp1252) zoals pdf-lib het voor de 14 standaardfonts encodeert. */
const WINANSI_EXTRA = [
  0x152, 0x153, 0x160, 0x161, 0x178, 0x17d, 0x17e, 0x192, 0x2c6, 0x2dc,
  0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020,
  0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122,
];
export const WINANSI_CODEPOINTS: ReadonlySet<number> = (() => {
  const set = new Set<number>(WINANSI_EXTRA);
  for (let c = 0x20; c <= 0x7e; c++) set.add(c);
  for (let c = 0xa0; c <= 0xff; c++) set.add(c);
  return set;
})();

/** Tekens buiten WinAnsi met een vaste vervanger (vóór transliteratie). */
const SUBSTITUTES: Record<string, string> = {
  "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2015": "-", "\u2212": "-",
  "\u2032": "'", "\u2033": '"', "\u02bc": "'", "\u2116": "No.",
  "\u2190": "<-", "\u2192": "->", "\u2264": "<=", "\u2265": ">=", "\u2260": "!=",
  "\u2713": "v", "\u2714": "v", "\u2717": "x", "\u2718": "x",
  "\u0131": "i", "\u0141": "L", "\u0142": "l", "\u0110": "D", "\u0111": "d",
  "\u0126": "H", "\u0127": "h", "\u0132": "IJ", "\u0133": "ij", "\u0149": "n",
  "\u2153": "1/3", "\u2154": "2/3", "\u215b": "1/8",
};

// Oekraïense nationale transliteratie (KMU 2010) als basis; Russisch-specifieke
// letters erbij. Woordbeginvorm (Ye/Yi/Y/Yu/Ya) vs. binnen het woord (ie/i/i/iu/ia).
const CYR_START: Record<string, string> = { "є": "ye", "ї": "yi", "й": "y", "ю": "yu", "я": "ya" };
const CYR: Record<string, string> = {
  "а": "a", "б": "b", "в": "v", "г": "h", "ґ": "g", "д": "d", "е": "e", "є": "ie",
  "ж": "zh", "з": "z", "и": "y", "і": "i", "ї": "i", "й": "i", "к": "k", "л": "l",
  "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
  "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch", "ь": "",
  "ю": "iu", "я": "ia", "ё": "yo", "ы": "y", "э": "e", "ъ": "", "ў": "u",
  "ђ": "dj", "ј": "j", "љ": "lj", "њ": "nj", "ћ": "c", "џ": "dz", "ѓ": "g", "ќ": "k", "ѕ": "dz",
};
// Russische tekst (zonder Oekraïense letters, mét ы/э/ё/ъ): г → g, и → i.
const CYR_RU: Record<string, string> = { "г": "g", "и": "i", "й": "y", "я": "ya", "ю": "yu", "е": "e" };
const RU_HINT = /[ыэёъЫЭЁЪ]/;
const UK_HINT = /[іїєґІЇЄҐ]/;

function isCyrillicLetter(ch: string | undefined): boolean {
  return !!ch && /[\u0400-\u04FF]/.test(ch);
}

function transliterateCyrillic(text: string): string {
  const russian = RU_HINT.test(text) && !UK_HINT.test(text);
  const chars = Array.from(text);
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (!/[\u0400-\u04FF]/.test(ch)) { out += ch; continue; }
    const lower = ch.toLowerCase();
    const wordStart = !isCyrillicLetter(chars[i - 1]);
    let latin: string | undefined;
    if (russian && CYR_RU[lower] !== undefined) latin = CYR_RU[lower];
    else if (wordStart && CYR_START[lower] !== undefined) latin = CYR_START[lower];
    else latin = CYR[lower];
    if (latin === undefined) { out += "?"; continue; }
    if (ch !== lower && latin) {
      const nextUpper = isCyrillicLetter(chars[i + 1]) && chars[i + 1] !== chars[i + 1].toLowerCase();
      const prevUpper = isCyrillicLetter(chars[i - 1]) && chars[i - 1] !== chars[i - 1].toLowerCase();
      latin = nextUpper || prevUpper ? latin.toUpperCase() : latin[0].toUpperCase() + latin.slice(1);
    }
    out += latin;
  }
  return out;
}

const REMOVED = "\uFFFF"; // non-character: markeert een weggehaalde emoji
// Emoji (incl. ZWJ-reeksen, vlaggen, keycaps, huidtinten) en onzichtbare tekens.
const EMOJI_RE = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/gu;
// Verbinders en presentatiekiezers als alternatie (niet in een klasse: no-misleading-character-class).
const EMOJI_GLUE_RE = /\u200D|\uFE0E|\uFE0F|\u20E3/g;
const INVISIBLE_RE = /[\u00AD\u200B\u200C\u2060\uFEFF]/g;
const SPACE_RE = /[\u2000-\u200A\u202F\u205F\u3000\u1680]/g;

export interface PdfSafeTextOptions {
  /** Codepoints die het font kan encoderen; standaard WinAnsi. */
  charset?: ReadonlySet<number>;
  /** Regeleinden behouden (drawText splitst zelf op \n). Standaard true. */
  keepNewlines?: boolean;
}

/**
 * Maakt tekst veilig voor een PDF-font: wat het font kan, blijft ongewijzigd
 * (é, ü, €, „”, –); de rest wordt vervangen. Volgorde: vaste vervangers →
 * emoji weg → Cyrillisch getranslitereerd → accenten gestript (ł, ș, ő) →
 * '?' voor wat overblijft (CJK, Arabisch, ...). Gooit nooit.
 */
export function pdfSafeText(input: unknown, opts: PdfSafeTextOptions = {}): string {
  if (input === null || input === undefined) return "";
  const charset = opts.charset ?? WINANSI_CODEPOINTS;
  const keepNewlines = opts.keepNewlines ?? true;
  let s = String(input);

  // Snelle weg: alles al encodeerbaar.
  let ok = true;
  for (const ch of s) {
    if (!charset.has(ch.codePointAt(0)!)) { ok = false; break; }
  }
  if (ok) return s;

  s = s.replace(/\r\n?/g, "\n").replace(/\t/g, " ");
  if (!keepNewlines) s = s.replace(/\n/g, " ");
  s = s.replace(EMOJI_RE, REMOVED).replace(EMOJI_GLUE_RE, REMOVED).replace(INVISIBLE_RE, "").replace(SPACE_RE, " ");
  // Een weggehaalde emoji laat geen dubbele spatie achter.
  s = s.replace(/(^| )\uFFFF+ /g, "$1").replace(/\uFFFF+/g, "");
  s = transliterateCyrillic(s);

  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (charset.has(cp) || (keepNewlines && ch === "\n")) { out += ch; continue; }
    const sub = SUBSTITUTES[ch];
    if (sub !== undefined && Array.from(sub).every((c) => charset.has(c.codePointAt(0)!))) {
      out += sub;
      continue;
    }
    // Accenten strippen: ș → s, ő → o, č → c (alleen als het resultaat past).
    const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (base && base !== ch && Array.from(base).every((c) => charset.has(c.codePointAt(0)!))) {
      out += base;
      continue;
    }
    if (/[\u0300-\u036f]/.test(ch)) continue; // losse combinerende tekens
    out += charset.has(0x3f) ? "?" : "";
  }
  return out;
}

/** Het deel van een pdf-lib PDFFont dat we nodig hebben (structureel getypt). */
export interface HardenablePdfFont {
  encodeText(text: string): unknown;
  widthOfTextAtSize(text: string, size: number): number;
  getCharacterSet?(): number[];
}

const HARDENED = "__sellqoPdfSafe";

/**
 * Maakt een embedded font crashvrij: `encodeText` en `widthOfTextAtSize`
 * saneren hun invoer eerst met `pdfSafeText` tegen de echte tekenset van het
 * font. drawText (ook met maxWidth) en wrapTextToWidth lopen via die twee.
 * Idempotent; geeft hetzelfde object terug.
 */
export function hardenPdfFont<F extends HardenablePdfFont>(font: F): F {
  const marked = font as F & { [HARDENED]?: boolean };
  if (marked[HARDENED]) return font;
  let charset: ReadonlySet<number> = WINANSI_CODEPOINTS;
  try {
    const list = font.getCharacterSet?.();
    if (list && list.length) charset = new Set(list);
  } catch {
    // val terug op WinAnsi
  }
  const encode = font.encodeText.bind(font);
  const width = font.widthOfTextAtSize.bind(font);
  const opts = { charset, keepNewlines: false };
  font.encodeText = (text: string) => encode(pdfSafeText(text, opts));
  font.widthOfTextAtSize = (text: string, size: number) => width(pdfSafeText(text, opts), size);
  marked[HARDENED] = true;
  return font;
}

interface WidthFont {
  widthOfTextAtSize: (text: string, size: number) => number;
}

/**
 * Breekt `text` op woordgrenzen in regels die binnen `maxWidth` (punten)
 * passen. Woorden die zelf te lang zijn worden hard gesplitst.
 */
export function wrapTextToWidth(
  text: string,
  font: WidthFont,
  size: number,
  maxWidth: number,
  maxLines = 4,
): string[] {
  const clean = pdfSafeText(text, { keepNewlines: false }).replace(/\s+/g, " ").trim();
  if (!clean) return [""];

  const lines: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current) {
      lines.push(current);
      current = "";
    }
  };

  for (const word of clean.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    pushCurrent();
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }
    // Woord past niet: hard splitsen per teken.
    let chunk = "";
    for (const ch of word) {
      if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    current = chunk;
  }
  pushCurrent();

  if (lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    trimmed[maxLines - 1] = `${trimmed[maxLines - 1]}...`;
    return trimmed;
  }
  return lines.length ? lines : [""];
}