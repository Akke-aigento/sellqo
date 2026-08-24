import { useTranslation } from 'react-i18next';
import type { Locale } from 'date-fns';
import { de, enUS, fr, nl, uk } from 'date-fns/locale';
import { DEFAULT_LANG, type LangCode } from '@/i18n/languages';

/**
 * date-fns-locale per app-taal.
 *
 * Zonder dit stond `locale: nl` hardcoded in tientallen componenten: de UI
 * wisselde wel van taal, maar "3 dagen geleden" en "maandag 4 maart" bleven
 * Nederlands. Het type is `Record<LangCode, Locale>`, dus zodra er een taal aan
 * SUPPORTED_LANGUAGES wordt toegevoegd faalt de typecheck hier — dat is
 * opzettelijk, het dwingt af dat de datumopmaak meegroeit.
 */
const LOCALES: Record<LangCode, Locale> = { nl, en: enUS, fr, de, uk };

/** Buiten een component (bijv. in een helper) — geef de taal expliciet mee. */
export function dateFnsLocaleFor(lang: string): Locale {
  return LOCALES[lang as LangCode] ?? LOCALES[DEFAULT_LANG];
}

export function useDateFnsLocale(): Locale {
  const { i18n } = useTranslation();
  return dateFnsLocaleFor(i18n.language);
}
