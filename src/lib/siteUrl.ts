/**
 * Publieke host van SellQo.
 *
 * Bewust een constante en niet `window.location.origin`: in de Capacitor-app is
 * die origin `capacitor://localhost` (iOS) of `https://localhost` (Android),
 * omdat `capacitor.config.ts` geen server-blok heeft. Een winkel-URL die daar
 * tegen wordt opgebouwd is onbruikbaar — je kunt hem niet openen, niet delen en
 * niet kopiëren.
 *
 * Dezelfde waarde staat in `scripts/generate-sitemap.ts`,
 * `src/components/seo/PageMeta.tsx`, `src/pages/public/BlogPost.tsx` en
 * `src/lib/structuredData.ts`. Die zijn hier bewust niet op omgehangen: dat is
 * een opruimactie op zichzelf, geen onderdeel van deze bugfix.
 */
export const PUBLIC_SITE_URL = 'https://sellqo.app';
