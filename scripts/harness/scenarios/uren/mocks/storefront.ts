// useStorefront / useFrontendMode zoals voor een zaak op het SellQo-thema.
export function useFrontendMode() { return { isCustomFrontend: false, customFrontendUrl: null, isLoading: false }; }
export function useStorefront() {
  const m = { mutate: () => {}, mutateAsync: async () => {}, isPending: false };
  return { themeSettings: { logo_url: null, favicon_url: null, brand_color: '#0d9488', primary_color: '#0d9488', theme_config: {} }, isLoading: false,
    sections: [], pages: [], settingsLoading: false, sectionsLoading: false,
    saveThemeSettings: m, homepageSections: [], sectionsLoading: false, createSection: m, updateSection: m, deleteSection: m, reorderSections: m };
}
