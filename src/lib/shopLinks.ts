/**
 * Links uit tenant-content oplossen tegen het winkelpad.
 *
 * De sectie-editor slaat bewust shop-relatieve paden op (`SectionEditor.tsx`
 * biedt `/products`, `/cart`, `/` aan). De renderers moeten die tegen het
 * winkelpad van de tenant oplossen — `HeroSection` en `TextImageSection` deden
 * dat niet, waardoor een knop in de admin-app belandde in plaats van in de
 * winkel. Zie docs/webshop-batch-5a-recon.md §3.
 *
 * De functie is **idempotent**: een pad dat al met `basePath` begint blijft
 * ongemoeid. Daardoor blijven bestaande opgeslagen waarden werken en is er geen
 * datamigratie nodig — wat ook betekent dat de `homepage_sections` van de
 * custom-frontend tenants onaangeroerd blijven (§6 van diezelfde recon).
 */

/**
 * Schemes die nooit als href worden doorgegeven. `button_link` is
 * tenant-invoer die op een publieke winkelpagina terechtkomt; `javascript:` en
 * `data:` zijn daar scriptinjectie-vectoren.
 */
const UNSAFE_SCHEME = /^(?:javascript|data|vbscript):/i;

/** Absolute URL (`https:`, `mailto:`, `tel:`) of protocol-relatief (`//`). */
const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export interface ResolvedShopLink {
  /** Het uiteindelijke doel. Leeg betekent: niets renderen. */
  href: string;
  /**
   * Extern doel. De caller moet dit als `<a>` renderen, niet als `<Link>`:
   * react-router 6 behandelt een absolute URL als relatief pad, waardoor
   * `https://voorbeeld.nl` als `/shop/<slug>/https://voorbeeld.nl` eindigt.
   */
  isExternal: boolean;
}

const EMPTY: ResolvedShopLink = { href: '', isExternal: false };

/**
 * Lost een link uit sectie-content op tegen het winkelpad.
 *
 * @param link     rauwe waarde uit `content.button_link` en verwanten
 * @param basePath winkelpad van de tenant, bijvoorbeeld `/shop/demo-bakkerij`
 */
export function resolveShopLink(
  link: string | null | undefined,
  basePath: string
): ResolvedShopLink {
  const raw = (link ?? '').trim();
  if (!raw) return EMPTY;

  // Onveilige schemes worden weggegooid, niet doorgegeven.
  if (UNSAFE_SCHEME.test(raw)) return EMPTY;

  // Externe doelen blijven zoals ze zijn.
  if (ABSOLUTE_URL.test(raw)) return { href: raw, isExternal: true };

  // Fragment of query-only verwijst binnen de huidige pagina; prefixen zou de
  // betekenis veranderen.
  if (raw.startsWith('#') || raw.startsWith('?')) {
    return { href: raw, isExternal: false };
  }

  const base = basePath.trim().replace(/\/+$/, '');

  // Zonder winkelpad valt er niets op te lossen; de waarde blijft ongemoeid.
  if (!base) return { href: raw, isExternal: false };

  // Al opgelost. De grenscontrole voorkomt dat `/shop/demo-bakkerij` ten
  // onrechte als "begint met /shop/demo" wordt gezien.
  if (
    raw === base ||
    raw.startsWith(`${base}/`) ||
    raw.startsWith(`${base}?`) ||
    raw.startsWith(`${base}#`)
  ) {
    return { href: raw, isExternal: false };
  }

  const path = raw.startsWith('/') ? raw : `/${raw}`;

  // De winkel-homepage is het winkelpad zelf, zonder trailing slash.
  if (path === '/') return { href: base, isExternal: false };

  return { href: `${base}${path}`, isExternal: false };
}
