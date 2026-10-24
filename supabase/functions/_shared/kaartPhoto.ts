// KAART-2 — foto van een menukaart → kaartlijnen. Pure functies (geen Deno-API's), zodat
// zowel de edge function ai-kaart-photo als de vitest-tests (src/) ze gebruiken.

/** Prijs per foto. Zelfde vaste prijs als de andere menu-AI (ai-generate-daily-menu: 5). */
export const KAART_PHOTO_CREDITS = 5;
export const KAART_PHOTO_MODEL = "google/gemini-3-flash-preview";
/** ±6 MB aan base64: een foto die de app al verkleind heeft, past ruim. */
export const KAART_PHOTO_MAX_CHARS = 8_000_000;
export const KAART_PHOTO_MAX_ITEMS = 300;

export interface KaartPhotoItem {
  name: string;
  /** "4.50" of null als er geen (leesbare) prijs bij stond. */
  price: string | null;
  category: string | null;
}

const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** Enkel een verkleinde jpeg/png/webp als data-URL. */
export function validImage(dataUrl: unknown): dataUrl is string {
  return typeof dataUrl === "string" && dataUrl.length <= KAART_PHOTO_MAX_CHARS && IMAGE.test(dataUrl);
}

export function kaartPhotoPrompt(language: string): string {
  const lang: Record<string, string> = { nl: "Nederlands", en: "English", fr: "français", de: "Deutsch", uk: "українська" };
  return [
    "Je leest een foto van een menukaart, krijtbord of prijslijst van een café, bar of restaurant.",
    "Geef ALLEEN geldige JSON terug, zonder uitleg, in deze vorm:",
    '{"items":[{"name":"Duvel","price":4.5,"category":"Bieren"}]}',
    "Regels:",
    "- name: de productnaam zoals op de kaart (niet vertalen, geen beschrijving, geen allergenen).",
    "- price: de prijs in euro als getal (4.5), of null als je hem niet zeker kan lezen. Nooit gokken.",
    "- Meerdere maten of formaten met elk een prijs (bv. 25cl / 33cl, glas / fles, klein / groot): elk een eigen item, met de maat in de naam (\"Pils 25cl\").",
    "- category: het kopje waaronder het product staat (bv. \"Bieren\", \"Warme dranken\"), of null als er geen kopje is.",
    "- Sla dingen over die geen product zijn: openingsuren, slogans, adressen, totalen, \"supplement\"-regels zonder product.",
    `- Als je moet kiezen hoe je een kopje schrijft: gebruik de taal van de kaart; anders ${lang[language] ?? "Nederlands"}.`,
    `- Maximaal ${KAART_PHOTO_MAX_ITEMS} items.`,
  ].join("\n");
}

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

function toPrice(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[€\s]/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 99999.99) return null;
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** Het antwoord van het model (tekst) → nette lijnen. Onleesbaar = null (dan niets afrekenen). */
export function parseKaartPhotoResponse(text: string): KaartPhotoItem[] | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const items = (parsed as { items?: unknown })?.items;
  if (!Array.isArray(items)) return null;
  const out: KaartPhotoItem[] = [];
  for (const raw of items) {
    if (out.length >= KAART_PHOTO_MAX_ITEMS) break;
    const r = raw as Record<string, unknown>;
    const name = clean(r?.name, 150);
    if (!name) continue;
    out.push({ name, price: toPrice(r?.price), category: clean(r?.category, 80) || null });
  }
  return out;
}
