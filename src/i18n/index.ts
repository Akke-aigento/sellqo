import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import nl from './locales/nl.json';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import landingNl from './locales/landing.nl.json';
import landingEn from './locales/landing.en.json';
import landingDe from './locales/landing.de.json';
import landingFr from './locales/landing.fr.json';

// Get stored language or detect from browser
const getInitialLanguage = (): string => {
  // Check localStorage first (for quick access before auth loads)
  const stored = localStorage.getItem('preferredLanguage');
  if (stored && ['nl', 'en', 'de', 'fr'].includes(stored)) {
    return stored;
  }
  
  // Fall back to browser language
  const browserLang = navigator.language.split('-')[0];
  if (['nl', 'en', 'de', 'fr'].includes(browserLang)) {
    return browserLang;
  }
  
  return 'nl'; // Default
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      nl: { translation: { ...nl, ...landingNl } },
      en: { translation: { ...en, ...landingEn } },
      de: { translation: { ...de, ...landingDe } },
      fr: { translation: { ...fr, ...landingFr } },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'nl',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
