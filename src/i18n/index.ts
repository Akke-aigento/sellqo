import i18n from 'i18next';
import { PRICE_VAR_NAMES } from '@/lib/priceVars';
import { initReactI18next } from 'react-i18next';

import { LANG_CODES, DEFAULT_LANG } from './languages';

import nl from './locales/nl.json';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import uk from './locales/uk.json';
import landingNl from './locales/landing.nl.json';
import landingEn from './locales/landing.en.json';
import landingDe from './locales/landing.de.json';
import landingFr from './locales/landing.fr.json';
import landingUk from './locales/landing.uk.json';

// Get stored language or detect from browser
const getInitialLanguage = (): string => {
  // Check localStorage first (for quick access before auth loads)
  const stored = localStorage.getItem('preferredLanguage');
  if (stored && (LANG_CODES as string[]).includes(stored)) {
    return stored;
  }

  // Fall back to browser language
  const browserLang = navigator.language.split('-')[0];
  if ((LANG_CODES as string[]).includes(browserLang)) {
    return browserLang;
  }

  return DEFAULT_LANG; // Default
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      nl: { translation: { ...nl, ...landingNl } },
      en: { translation: { ...en, ...landingEn } },
      de: { translation: { ...de, ...landingDe } },
      fr: { translation: { ...fr, ...landingFr } },
      uk: { translation: { ...uk, ...landingUk } },
    },
    lng: getInitialLanguage(),
    fallbackLng: DEFAULT_LANG,
    interpolation: {
      escapeValue: false,
      // PLANS-2 — prijzen worden door PriceVarsSync gezet uit pricing_plans/platform_addons.
      defaultVariables: {},
    },
    // PLANS-2 — zolang de prijzen laden geen "{{flex_fee}}" tonen; andere ontbrekende
    // variabelen blijven zichtbaar zoals voorheen.
    missingInterpolationHandler: (_str: string, match: RegExpExecArray) =>
      (PRICE_VAR_NAMES as readonly string[]).includes(match[1].trim()) ? '' : match[0],
  });

export default i18n;
