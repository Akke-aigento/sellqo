// UREN-1c — het thema waarmee een nieuwe horecazaak start (create-tenant, plan met spoor horeca).
// Bron: het themaschema van de standaardshop, sellqo-storefront src/theme/schema.json, preset "bistro"
// (theme.brand_color, theme.heading_font, theme.body_font). De kopie hier wordt bewaakt door
// horecaStartTheme.test.ts (vaste waarden, en tegen het echte schema als SELLQO_STOREFRONT_SCHEMA naar dat
// bestand wijst) en aan de storefront-kant door scripts/horeca-start.test.ts. Wijzig je de preset, pas dan
// beide aan.
// primary_color = brand_color: de standaardshop leest primary_color, en Branding houdt ze gelijk (UREN-1b).
export const HORECA_START_PRESET = 'bistro';
export const HORECA_START_THEME = {
  brand_color: '#2f5d46',
  primary_color: '#2f5d46',
  heading_font: 'Playfair Display',
  body_font: 'Lato',
} as const;

/** Patch voor de vers aangemaakte tenant_theme_settings-rij. */
export function horecaStartThemePatch() {
  return { theme_config: { preset: HORECA_START_PRESET }, ...HORECA_START_THEME };
}
