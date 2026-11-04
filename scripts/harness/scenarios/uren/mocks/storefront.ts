// useStorefront / useFrontendMode zoals voor een zaak op het SellQo-thema. Stabiele objecten (zoals react-query).
export function useFrontendMode() { return { isCustomFrontend: false, customFrontendUrl: null, isLoading: false }; }
const m = { mutate: () => {}, mutateAsync: async () => {}, isPending: false };
import { H } from './h';
const themeSettings = { logo_url: H.logo === 'set' ? 'https://x/logo.png' : null, favicon_url: null, brand_color: '#0d9488', primary_color: '#0d9488', theme_config: { preset: 'standaard' } };
const value = { themeSettings, isLoading: false, sections: [], pages: [], settingsLoading: false, sectionsLoading: false,
  saveThemeSettings: m, homepageSections: [], sectionsLoading2: false, createSection: m, updateSection: m, deleteSection: m, reorderSections: m };
export function useStorefront() { return value; }
