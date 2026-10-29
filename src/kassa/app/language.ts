// KASSA-UX-2 — taal van de kassa. Standaard de taal van de zaak (tenants.language), niet die van
// het toestel: personeel deelt toestellen en een zaak werkt in één taal. Wie wil, kiest op dit
// toestel een andere taal in het ⋯-menu. Raakt de taal van het beheer niet ('preferredLanguage').
import { DEFAULT_LANG, LANG_CODES } from '@/i18n/languages';

export const KASSA_LANG_KEY = 'sq_kassa_lang';

const valid = (x: string | null | undefined): x is string => !!x && (LANG_CODES as readonly string[]).includes(x);

/** Gekozen taal op dit toestel (null = volgt de zaak). */
export function deviceLanguage(): string | null {
  try { const v = localStorage.getItem(KASSA_LANG_KEY); return valid(v) ? v : null; } catch { return null; }
}

/** Welke taal de kassa toont: keuze van het toestel, anders de zaak, anders Nederlands. */
export function kassaLanguage(tenantLanguage: string | null | undefined, device: string | null = deviceLanguage()): string {
  if (valid(device)) return device;
  const base = tenantLanguage?.split('-')[0]?.toLowerCase();
  return valid(base) ? base : DEFAULT_LANG;
}

/** Keuze op dit toestel bewaren (null = terug naar de taal van de zaak). */
export function setDeviceLanguage(code: string | null): void {
  try { if (valid(code)) localStorage.setItem(KASSA_LANG_KEY, code); else localStorage.removeItem(KASSA_LANG_KEY); } catch { /* privémodus */ }
}
