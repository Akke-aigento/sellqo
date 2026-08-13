# WEBSHOP-5A — Recon: renderregister en links

**Status:** recon afgerond, wacht op go voor implementatie — 2026-08-13
**Scope van deze recon:** alleen docs. Geen code gewijzigd.
**Feitenbasis:** uitgevoerd op `c93cfff0`
**Plan:** `docs/webshop-fase5-masterplan.md` §3 · **Werkwijze:** `CLAUDE.md`

---

## 1. Het renderregister

Er is **geen register — er is een `switch`.** `ShopHome.tsx:20-45` mapt de negen sectie-types handmatig, met negen losse imports (regels 4-12).

De props zijn daarbij **niet uniform**. Vijf types krijgen `tenantId` mee (hero, featured_products, collection, newsletter, external_reviews), vier niet (text_image, testimonials, video, announcement). Bij `hero` is het zelfs overbodig: `HeroSection` gebruikt `tenantId` nergens. Een register moet dus één propvorm afdwingen, anders verplaatst het de rommel in plaats van hem op te lossen.

`VisualEditorCanvas.tsx:144-156` heeft een **tweede, afwijkende** switch naar de admin-tweelingen: vier takken plus een `default`. Twee mappings die uit de pas kunnen lopen — en dat ook doen (zie §3 van de fase-5-recon).

**Voorgestelde plek:** `src/components/storefront/sections/registry.tsx`, naast de renderers.

- De admin importeert al vrijuit uit `components/storefront/` (`ShopLayout`, `ProductCard`, en de tweelingen doen dat).
- De omgekeerde richting zou de winkel afhankelijk maken van admin-code.
- Het register staat zo naast de componenten die het beschrijft.

Vorm: `Record<HomepageSectionType, ComponentType<SectionRenderProps>>` met `SectionRenderProps = { section, tenantId?, basePath }`. `ShopHome` wordt een `map` over het register; de editor gebruikt hetzelfde register.

---

## 2. `resolveShopLink` — helper bestaat niet, conventie wel

`/shop/${tenantSlug}` wordt op **ruim twintig plekken inline** opgebouwd: `ShopLayout.tsx:297`, `ShopProducts.tsx:61`, `ShopWishlist.tsx:15`, `ShopLegalPage.tsx:38` en verspreid door alle winkelpagina's.

Wat wél bestaat is een **prop-conventie**: `basePath: string` wordt geaccepteerd door `ProductCard`, `CartDrawer`, `MobileBottomNav`, `QuickViewModal`, `SearchModal`, `RelatedProducts` en `MegaMenu`. De sectie-renderers doen daar nog niet aan mee — `CollectionSection.tsx:68` en `FeaturedProductsSection.tsx:68` bouwen hun eigen `basePath` ter plekke om hem aan `ProductCard` te geven.

De helper past dus in de bestaande stijl: `basePath` binnenkrijgen als prop, en `resolveShopLink(link, basePath)` toepassen op wat uit `content` komt.

### 2.1 Een tweede, niet eerder gemelde bug

`react-router-dom` staat op `^6.30.1`. In v6 behandelt `<Link to="https://example.com">` een absolute URL als een **relatief pad**. Een externe link in `button_link` is vandaag dus óók al kapot, los van het ontbrekende winkelpad.

De helper moet dat afvangen door externe URL's als `<a>` te renderen in plaats van als `<Link>`. Daarmee is 5A niet alleen een reparatie maar een echte uitbreiding.

---

## 3. De vier fixes — niet identiek

| Bestand | Regel | Huidige code | Context |
|---|---|---|---|
| `HeroSection.tsx` | 61 | `to={content.button_link}` | winkel, `/shop/:tenantSlug` |
| `TextImageSection.tsx` | 43 | `to={content.button_link}` | winkel, `/shop/:tenantSlug` |
| `EditableHeroSection.tsx` | 82 | `to={content.button_link \|\| '#'}` | **admin**, `/admin/storefront` |
| `EditableTextImageSection.tsx` | 66 | `to={content.button_link \|\| '#'}` | **admin**, `/admin/storefront` |

Het correcte patroon bestaat al: `CollectionSection.tsx:77` bouwt `` `/shop/${tenantSlug}/products?category=...` `` met `useParams`.

**De twee groepen hebben niet dezelfde fix.** De echte renderers draaien onder `/shop/:tenantSlug` en kunnen `useParams` of een `basePath`-prop gebruiken. De twee tweelingen draaien in de **admin**, waar die route-parameter niet bestaat — `useParams().tenantSlug` is daar leeg. Zij moeten de slug uit `useTenant()` halen. Wie hier klakkeloos hetzelfde patroon toepast, krijgt `/shop/undefined/products`.

`EditableImageTextBlock.tsx` bleek géén `<Link>` te renderen — alleen een inline tekstveld voor de knoptekst. Valt buiten scope.

---

## 4. De seeds en `{{shop}}`

| Locatie | Wat |
|---|---|
| `types/storefront.ts:31` | `export const SHOP_PATH_PLACEHOLDER = '{{shop}}'` |
| `useTemplateSeed.ts:7` | import |
| `useTemplateSeed.ts:21-38` | `resolveShopPaths()` — recursief over `content` en `pages` |
| migratie `20260812143000` | 6 voorkomens in `seed_definition` |

**Twee databronnen, twee toestanden:**

- `themes.seed_definition` bevat de letterlijke placeholder `{{shop}}/products`.
- `homepage_sections.content` bevat bij tenants die een template toepasten de opgeloste absolute waarde `/shop/<slug>/products`.

**Kernconclusie:** als `resolveShopLink` idempotent is — een al-geprefixt pad ongemoeid laat — dan is er **geen datamigratie nodig**. Bestaande absolute waarden blijven werken. Normalisatie van `homepage_sections` wordt optionele opruiming in plaats van een voorwaarde.

Wat wél moet: `seed_definition` van de drie template-rijen naar de relatieve conventie (`/products`) via een additieve migratie met `ON CONFLICT (slug) DO UPDATE`, en daarna de placeholder-logica uit `useTemplateSeed.ts` en `types/storefront.ts`. Dat raakt alleen nieuwe template-toepassingen.

Achtergrond: de `{{shop}}`-placeholder uit WEBSHOP-3 omzeilde de renderer-bug in plaats van hem op te lossen, en introduceerde daarmee een tweede conventie naast die van `SectionEditor.tsx:66-79` (die bewust `/products`, `/cart`, `/` schrijft). 5A brengt dat terug naar één.

---

## 5. Risicocheck tegen de eerste wet

**Sleutelnamen: geen enkele wijziging.** `button_link` blijft `button_link`. De helper verandert alleen de interpretatie bij het renderen. Dat valt onder "uiterlijk mag herbouwd worden" en raakt het contract niet.

**Eén punt raakt de eerste wet wel.** `storefront-api/index.ts:3637` biedt de publieke actie `get_homepage` aan met `Cache-Control: public, max-age=300`. Die roept `getHomepage()` aan (regels 763-771), dat `content` **verbatim** teruggeeft:

```js
.select('id, section_type, title, content, settings, sort_order, is_visible')
.eq('tenant_id', tenantId).eq('is_visible', true)
```

Een custom frontend kan `button_link` dus letterlijk uitlezen. **Het wijzigen van opgeslagen waarden is daarmee potentieel zichtbaar voor de vijf custom-frontend tenants.** Een blanket `UPDATE` op `homepage_sections` is precies het soort actie waar §0 tegen beschermt.

De mitigatie is de idempotente helper: data blijft ongemoeid, risico nul.

---

## 6. Besluit — data van VanXcel en Loveke blijft ongemoeid

**Aanleiding.** VanXcel en Loveke (beide custom-frontend) hebben nog `homepage_sections`-rijen uit februari 2026, sindsdien niet aangeraakt. Vermoeden: dode data van vóór hun overstap naar een eigen frontend.

**Onderzocht op 13-08-2026. Uitkomst: niet aantoonbaar dood.**

Wat is vastgesteld:

1. **`get_homepage` is publiek en bereikbaar.** Geen API-key-check in de dispatcher; alleen een rate-limit per `tenant_id` (`index.ts:3603`). Wie het tenant-id kent, krijgt de secties.
2. **Er is geen telemetrie.** `storefront-api` logt acties alleen naar de console, niet naar een tabel. Er is geen databron waaruit blijkt of de actie wordt aangeroepen.
3. **De custom-frontend repos zijn hier niet beschikbaar.** Hun code kan niet gegrepen worden vanuit deze repo.
4. **Beide draaien via `sellqo-proxy`**, een edge-functie op een ánder Supabase-project (`jpnacppdutjnasmuikgp`) die niet in git staat — zie `docs/sellqo-proxy-recon.md`. Bevestigd voor VanXcel via black-box-probes, en voor beide via `.agents/skills/sellqo-custom-frontend-runbook/SKILL.md` patroon 2a.
5. **De proxy-probe van 02-06-2026 vond zeven herkende paden:** `/products`, `/categories`, `/collections`, `/pages`, `/cart`, `/checkout`, `/newsletter`. Geen homepage-pad daarbij — **maar `/homepage` is destijds ook niet geprobeerd**, dus dat is geen weerlegging. Bovendien doet de proxy een fallback met `segments.join('_')`, waardoor een pad als `/get/homepage` alsnog op `get_homepage` uitkomt.
6. **De runbook noemt homepage of secties nergens.** Zwakke ondersteuning voor het vermoeden, geen bewijs.

**Besluit (Akke, 13-08-2026):** 5A gaat door **zonder deze data aan te raken**. De idempotente `resolveShopLink` maakt de migratie overbodig, dus er is geen reden het risico te nemen.

**Geparkeerd als aparte latere stap:** het opruimen van de februari-rijen van VanXcel en Loveke. Start pas nadat een netwerk-check op hun live sites (vanxcel.be en de Loveke-site, tabblad Netwerk) aantoont dat er geen homepage-actie langskomt. Krijgt dan een eigen role-audit-entry.

Deze DB-check kan het beeld alvast scherper maken — staan de secties al op `is_visible = false`, dan serveert `get_homepage` ze sowieso niet:

```sql
SELECT t.slug, hs.section_type, hs.is_visible, hs.updated_at,
       hs.content ->> 'button_link' AS button_link
FROM homepage_sections hs
JOIN tenants t ON t.id = hs.tenant_id
WHERE t.slug IN ('vanxcel','loveke')
ORDER BY t.slug, hs.sort_order;
```

---

## 7. Implementatieplan 5A

| Stap | Wat | Raakt |
|---|---|---|
| 1 | **`resolveShopLink(link, basePath)`** — puur, idempotent. Vier gevallen: leeg → leeg; extern (`http`, `https`, `mailto`, `tel`, `//`) → ongemoeid, als `<a>`; al beginnend met `basePath` → ongemoeid; overig root-relatief → prefixen. Met vitest-dekking. | nieuw bestand |
| 2 | **Renderregister** in `sections/registry.tsx`, één propvorm. `ShopHome` wordt een `map`. Geen gedragswijziging. | `ShopHome.tsx` |
| 3 | **Twee echte renderers** krijgen `basePath` via het register en gebruiken de helper. | `HeroSection`, `TextImageSection` |
| 4 | **Twee tweelingen** — dezelfde helper, maar slug uit `useTenant()`. Zie §8.1. | `EditableHeroSection`, `EditableTextImageSection` |
| 5 | **Seeds** — additieve migratie zet de drie `seed_definition`-waarden op de relatieve conventie; placeholder-logica eruit. | migratie, `useTemplateSeed.ts`, `types/storefront.ts` |
| 6 | **Verificatie** — `tsc`, build, eslint tegen baseline, vitest. Smoke-test op Speeltuin. | — |

**Smoke-test moet aantonen:** alle negen sectie-types renderen identiek aan vóór de wijziging; een heroknop met `/products` landt op `/shop/<slug>/products`; een externe URL blijft extern; een tenant die ná de migratie een template toepast krijgt werkende knoppen.

### 7.1 Slottaken (CLAUDE.md §4)

- **Role-audit** — verplicht. 5A raakt `ShopHome`, een gedeeld renderpad. De entry krijgt een expliciete gedeelde-paden-paragraaf over `get_homepage` en over het besluit uit §6.
- **Changelog, 4 talen** — gerechtvaardigd: kapotte knoppen gaan werken. Entry in `PublicChangelog.tsx` (`RELEASES`) plus `public.changelog.changes.<id>` in alle vier de `landing.*.json`.
- **`doc_articles`** — voorstel: pas bij 5B, wanneer er iets zichtbaars te documenteren valt.
- **Newsletter-wachtrij** — item onder **Openstaand** zodra de changelog-entry staat.

---

## 8. Open punten vóór de go

### 8.1 Fixen we de twee tweelingen in 5A?

Ze sneuvelen toch in 5B. Vóór fixen: de admin-preview toont anders kapotte links in de tussentijd, en 5B kan uitlopen. Tegen: weggegooid werk.

**Voorstel: wel fixen.** Het zijn vier regels.

### 8.2 Normaliseren we `homepage_sections`?

**Beslist in §6: nee.** De idempotente helper maakt het overbodig en houdt het risico voor de custom frontends op nul. Twee conventies blijven naast elkaar bestaan in bestaande data, maar geen van beide is kapot.

### 8.3 Staat van de testsuite

`package.json` heeft een `test`-script (`vitest run`), maar er is **niet gecontroleerd** hoeveel tests er zijn en of ze groen zijn. Stap 1 van de implementatie begint daarom met die vaststelling — een nieuwe test toevoegen aan een suite die al rood staat, maakt de verificatie waardeloos.
