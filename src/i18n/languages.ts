/**
 * Bron van waarheid voor de ondersteunde talen van de SellQo core.
 *
 * Elke allowlist, z.enum, taal-switcher en browser-detectie in de codebase leidt
 * zijn talen HIERVAN af. Kom je ergens een eigen hardcoded array van taalcodes
 * tegen — dat is een bug; vervang door LANG_CODES.
 *
 * Zie .agents/skills/sellqo-i18n-verplicht/SKILL.md voor de werkwijze en het
 * recept om een nieuwe taal toe te voegen.
 *
 * Let op: een taal hoort hier pas thuis zodra haar locale-bestanden
 * (locales/{code}.json en locales/landing.{code}.json) bestaan én in
 * src/i18n/index.ts als resource geregistreerd zijn. Anders valt alles voor die
 * taal stil terug op het Nederlands (fallbackLng: 'nl').
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱', script: 'latin', dir: 'ltr' },
  { code: 'en', label: 'English',    flag: '🇬🇧', script: 'latin', dir: 'ltr' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷', script: 'latin', dir: 'ltr' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪', script: 'latin', dir: 'ltr' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦', script: 'cyrillic', dir: 'ltr' },
  // TODO batch 1: es/it/pt/pl toevoegen zodra hun locale-JSON's bestaan
] as const;

export type LangCode = typeof SUPPORTED_LANGUAGES[number]['code'];

export const LANG_CODES = SUPPORTED_LANGUAGES.map(l => l.code) as LangCode[];

export const DEFAULT_LANG: LangCode = 'nl';

/** Zod-helper: z.enum verlangt een niet-lege tuple, LANG_CODES is een array. */
export const LANG_CODES_TUPLE = LANG_CODES as [LangCode, ...LangCode[]];

/** Type-guard voor onbekende input (localStorage, DB-kolommen, query params). */
export function isLangCode(value: unknown): value is LangCode {
  return typeof value === 'string' && (LANG_CODES as string[]).includes(value);
}
