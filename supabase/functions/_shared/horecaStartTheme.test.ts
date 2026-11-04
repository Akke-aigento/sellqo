// UREN-1c — de starttheme-kopie voor horeca blijft gelijk aan de preset "bistro" van de standaardshop.
// Run: deno test --no-lock supabase/functions/_shared/horecaStartTheme.test.ts
// Tegen het echte schema (lokaal, naast een clone van sellqo-storefront):
//   SELLQO_STOREFRONT_SCHEMA=../sellqo-storefront/src/theme/schema.json deno test --allow-env --allow-read --no-lock …
import { HORECA_START_PRESET, HORECA_START_THEME, horecaStartThemePatch } from './horecaStartTheme.ts';

function eq(actual: unknown, expected: unknown, msg = '') {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  verwacht: ${e}\n  gekregen: ${a}`);
}

Deno.test('horecastart: bistro met de vaste waarden van het schema (4-11-2026)', () => {
  eq(HORECA_START_PRESET, 'bistro');
  eq(HORECA_START_THEME, { brand_color: '#2f5d46', primary_color: '#2f5d46', heading_font: 'Playfair Display', body_font: 'Lato' });
  eq(horecaStartThemePatch(), { theme_config: { preset: 'bistro' }, brand_color: '#2f5d46', primary_color: '#2f5d46', heading_font: 'Playfair Display', body_font: 'Lato' });
});

Deno.test('horecastart: gelijk aan het echte themaschema (als SELLQO_STOREFRONT_SCHEMA gezet is)', async () => {
  let path: string | undefined;
  try { path = Deno.env.get('SELLQO_STOREFRONT_SCHEMA'); } catch { path = undefined; }
  if (!path) return;
  const schema = JSON.parse(await Deno.readTextFile(path)) as { presets: { id: string; vocabulary?: string; theme: Record<string, string | null> }[] };
  const p = schema.presets.find((x) => x.id === HORECA_START_PRESET);
  if (!p) throw new Error(`preset ${HORECA_START_PRESET} ontbreekt in ${path}`);
  eq(p.vocabulary, 'horeca', 'een horecathema');
  eq({ brand_color: p.theme.brand_color, heading_font: p.theme.heading_font, body_font: p.theme.body_font },
    { brand_color: HORECA_START_THEME.brand_color, heading_font: HORECA_START_THEME.heading_font, body_font: HORECA_START_THEME.body_font });
});
