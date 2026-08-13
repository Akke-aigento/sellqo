# WEBSHOP-5 — Masterplan: de editor-ervaring onberispelijk

**Status:** vastgesteld — 2026-08-13
**Eigenaar:** Akke · uitvoering via Claude Code
**Kompas:** `docs/webshop-fase5-7-visie.md` (fase A)
**Feitenbasis:** editor-recon van 13-08-2026, uitgevoerd op `ece8da40`
**Werkwijze:** `CLAUDE.md`

---

## 0. Waarom deze fase eerst

De visie (§0) zegt het scherp: de basis moet onberispelijk zijn vóór de AI erbovenop komt. De AI-build van fase C genereert secties, content en kleuren op de bouwstenen die hier gelegd worden. Rammelt die onderlaag, dan bouwt de AI op drijfzand en valt het resultaat tegen bij de eerste aanraking — precies wanneer we het promoten.

Binnen deze fase geldt dezelfde logica nog een keer: **de live preview komt eerst**, omdat alles erna er beter van wordt. Templates bouw je met preview, de sectie-editor voelt pas goed mét preview, en de AI-build toont z'n resultaat via diezelfde preview.

---

## 1. De eerste wet — wat vaststaat

Onverkort van kracht: `docs/webshop-masterplan.md` §0 en `CLAUDE.md` §1. De vijf custom-frontend tenants (Loveke, VanXcel, Astra Sleep, Mancini Milano, Zona Dorata) merken van deze fase niets.

De recon heeft de grens preciezer gemaakt dan hij stond. **Geen enkel React-component wordt gedeeld met de custom frontends** — `grep` op `components/storefront` in `supabase/functions/` geeft nul treffers. Zij halen data op via `storefront-api` en renderen zelf.

Daaruit volgt een scherpe, werkbare grens:

| | Mag | Mag niet |
|---|---|---|
| **Uiterlijk van een renderer** | volledig herbouwen | — |
| **Sleutelnamen in `content` / `settings`** | nieuwe sleutels toevoegen (additief) | hernoemen, weghalen, van betekenis veranderen |
| **Gedeelde tabellen** | `ADD COLUMN IF NOT EXISTS` | droppen, hernoemen, defaults wijzigen |
| **`storefront-api` / `checkout-engine` / `storefront-resolve`** | — | aanraken zonder aparte recon én akkoord |

Concreet betekent dat: `button_link`, `overlay_opacity`, `text_alignment`, `image_position`, `max_products`, `show_view_all` en alle andere sleutels binnen `content` en `settings` **liggen vast**. Ze stromen rauw door via `storefront-api/index.ts:766`:

```
select('id, section_type, title, content, settings, sort_order, is_visible')
```

Een custom frontend kan elke sleutel daarin uitlezen. Hernoemen breekt hun rendering zonder dat wij het merken.

> **Detail om te onthouden:** dat contract levert géén `subtitle` mee, terwijl onze secties dat veld wél hebben en onze seeds het vullen. Custom frontends zien die tekst dus nooit. Geen bug in onze richting, maar gebruik `subtitle` nooit als dragend veld.

**Testbedden:** SellQo Speeltuin en Demo Bakkerij. Elke batch daar gesmoke-test vóór "klaar".

---

## 2. Wat de recon vaststelde

Kort, als fundament onder de batch-indeling. Volledige onderbouwing in het recon-rapport.

**Negen sectie-types**, alle negen met een echte renderer in `src/components/storefront/sections/`, één-op-één gemapt in `ShopHome.tsx:23-40`. `SectionEditor.tsx` (653 regels) dekt alle negen met volwaardige formulieren.

**Maar er zijn twee parallelle renderers per sectie.** De echte, en een admin-tweeling in `visual-editor/sections/`. Van die tweelingen bestaan er maar **vier** (hero, text_image, featured_products, newsletter); de overige vijf vallen terug op `EditableGenericSection`, dat alleen titel en subtitel toont plus een gestippeld vlak met *"Configureer deze sectie via de instellingen"*. De preview is daardoor per definitie geen WYSIWYG.

**De echte renderers zijn licht.** Afhankelijkheden:

| Behoefte | Secties |
|---|---|
| Niets (pure props) | announcement, testimonials, video |
| Alleen `Link` | hero, text_image |
| `useParams` + `usePublicProducts` | collection, featured_products |
| `usePublicReviews` | external_reviews |
| `supabase` (aanmeldformulier) | newsletter |

Geen enkele heeft een `/shop`-route nodig — alleen een Router-context, een QueryClient en een `tenantId`. Alle drie al aanwezig in de admin.

**De links-bug zit in de renderer, niet in de data.** `SectionEditor.tsx:66-79` biedt bewust shop-relatieve waarden aan (`/products`, `/cart`, `/`, `/products?category=<slug>`). Twee renderers lossen die niet op tegen het winkelpad:

- `HeroSection.tsx:61` — `<Link to={content.button_link}>`
- `TextImageSection.tsx:43` — idem
- Plus de tweelingen: `EditableHeroSection.tsx:82`, `EditableTextImageSection.tsx:66`

Terwijl het correcte patroon er al is: `CollectionSection.tsx:77` bouwt netjes `` `/shop/${tenantSlug}/products?category=...` ``.

**Twee conventies naast elkaar.** De `{{shop}}`-placeholder uit WEBSHOP-3 omzeilde deze bug in plaats van hem op te lossen: de editor schrijft `/products`, de seeds schrijven `/shop/<slug>/products`. Dat moet weer één conventie worden.

---

## 3. Batch 5A — Renderregister en links

**Doel:** één bron van waarheid voor "welk component rendert welk sectie-type", en één conventie voor links. Fundament voor 5B.

### Scope

1. **Gedeeld renderregister** — één `section_type → component`-map die zowel `ShopHome` als de editor voedt. Vervangt de `switch` in `ShopHome.tsx:23-40` zonder het gedrag te wijzigen.
2. **`resolveShopLink(link, basePath)`-helper** — idempotent, drie gevallen:
   - externe URL's (`http://`, `https://`, `mailto:`, `tel:`) → ongemoeid
   - al-geprefixte paden (`/shop/<slug>/...`) → ongemoeid, zodat bestaande seed-data blijft werken
   - root-relatieve paden (`/products`) → prefixen met het winkelpad
3. **Vier renderers gefixt** — `HeroSection`, `TextImageSection` en de twee tweelingen gebruiken de helper.
4. **Seeds terug naar de relatieve conventie** — `{{shop}}` verdwijnt uit `seed_definition` en uit `useTemplateSeed.ts`. Vereist een additieve migratie die de drie template-rijen bijwerkt (`ON CONFLICT (slug) DO UPDATE`), plus een eenmalige normalisatie van reeds geseede tenant-data.

### Risico's en grenzen

- **De helper wijzigt geen enkele sleutelnaam.** `button_link` blijft `button_link`; alleen de interpretatie bij het renderen verandert. Contract intact.
- **De seed-normalisatie raakt tenant-data.** Alleen op de twee testbedden relevant (geen echte tenant gebruikt de ingebouwde webshop), maar de update moet idempotent zijn en alleen `/shop/<slug>`-prefixen strippen die exact overeenkomen.
- Het renderregister raakt `ShopHome`, dus de publieke winkel. Gedragsgelijkheid moet aantoonbaar zijn vóór 5B erop bouwt.

### Verificatie

`tsc`, build, eslint tegen baseline. Smoke-test op Speeltuin: alle negen sectie-types renderen identiek aan vóór de wijziging; een heroknop met `/products` landt op `/shop/<slug>/products`; een knop met een externe URL blijft extern.

---

## 4. Batch 5B — WYSIWYG-canvas

**Doel:** de editor toont de échte winkel, niet een benadering.

### Scope

1. **Editor bouwt op het register uit 5A.** Elke sectie wordt gerenderd door de echte storefront-renderer.
2. **Overlay-laag voor bewerken.** Selectie, toolbar, slepen en inline tekst komen als laag *boven* de renderer, niet erin. De winkelcode blijft schoon — dat is de voorwaarde die dit veilig maakt.
3. **De vier tweelingen en `EditableGenericSection` vervallen.** Alle negen types worden echt bewerkbaar; het gestippelde vlak verdwijnt.
4. **`PreviewPanel` heroverwegen.** De iframe naar `/shop/<slug>?preview=true` ververst alleen handmatig of na opslaan. Met een in-React canvas is hij mogelijk overbodig; anders blijft hij als "bekijk de echte pagina"-knop.

### Open punt binnen deze batch

De echte renderers hebben geen `InlineTextEditor`. De overlay-aanpak moet bewijzen dat inline bewerken werkt zonder de renderers aan te passen. Lukt dat niet voor een specifiek sectie-type, dan valt dat type terug op het formulier in `SectionEditor` — dat dekt alle negen types al volwaardig. Dat is een acceptabele uitkomst, geen blocker.

### Verificatie

Naast tsc/build/lint: per sectie-type visueel vergelijken tussen editor-canvas en de echte winkelpagina. Dat is de kern van "WYSIWYG" en moet expliciet worden nagelopen, niet aangenomen.

### Lost 5B en passant op — bewust niet eerder repareren

`PreviewPanel` (de iframe in de Homepage-sectie) **ververst niet bij een wijziging**. Het component importeert alleen `useTenant` voor de slug en kent de theme-instellingen niet; de iframe hangt aan een lokale `refreshKey` die uitsluitend door de handmatige verversknop wordt opgehoogd. Het bijschrift *"Preview wordt automatisch bijgewerkt na opslaan"* is daarmee **onwaar** — er bestaat geen mechanisme dat dat doet.

Niet repareren: het hele previewverhaal wordt in deze batch vervangen door het WYSIWYG-canvas op het renderregister. Zie ook OB-F5-3 over de vraag of `PreviewPanel` daarnaast blijft bestaan.

---

## 5. Batch 5C — Editor-polish

**Deze batch krijgt een eigen recon vóór uitvoering.** Reden: hij raakt een opslagformaat, niet alleen UI.

### Wat er speelt

**Het zware punt — JSON in een HTML-veld.** `StorefrontPagesManager.tsx:129` slaat bij "Visueel bewerken" op als `JSON.stringify(blocks)`, terwijl `RichTextEditor` in datzelfde `content`-veld HTML schrijft en `ShopPage.tsx:74` het onvoorwaardelijk rendert via `dangerouslySetInnerHTML`. Er is nergens formaatdetectie. Een pagina die via de visual editor is opgeslagen toont op de live winkel dus **letterlijke JSON**.

Twee schrijvers, één kolom, één lezer die maar één formaat kent. De oplossing raakt `storefront_pages.content` — mogelijk een additief `content_format`-veld, mogelijk detectie aan de renderkant. Welke van de twee, en wat er met bestaande data moet gebeuren, is precies wat de eigen recon moet uitwijzen. Vandaar de aparte stap.

**De lichtere punten:**

- **Herordenen doet één UPDATE per sectie.** `useStorefront.ts:374-380` draait een sequentiële lus; bij tien secties tien round-trips voordat de lijst klopt. Kandidaat voor één batched call.
- **Native `confirm()`** in `HomepageBuilder.tsx:197` en `VisualEditorCanvas.tsx:125`, terwijl de rest van de studio `AlertDialog` gebruikt.
- **Dode sleep-affordance** in `StorefrontPagesManager.tsx:310`: een `GripVertical` met `cursor-grab` zonder enige dnd-logica, waardoor `nav_order` via de UI niet te wijzigen is.

### Volgorde

De recon van 5C draait pas ná 5B, zodat de editor-architectuur vaststaat voordat we het opslagformaat aanpakken.

---

## 6. Slottaken per batch

Verplicht bij elke batch, conform `CLAUDE.md` §4. Deze zijn in WEBSHOP-1 t/m 4b vergeten; dat gebeurt hier niet meer.

| Slottaak | Waar |
|---|---|
| **Role-audit entry** | `docs/role-audit.md` — nieuwe sectie bovenaan met Root cause, Uitgevoerd, Security-keuzes, Gedeelde-paden-waarschuwing, Verificatie, Bewust ongemoeid |
| **Publieke changelog, 4 talen** | `src/pages/public/PublicChangelog.tsx` (`RELEASES`) **én** `public.changelog.changes.<id>` in `landing.{nl,en,fr,de}.json` — alle vier, pariteit bewaken |
| **`doc_articles`** | migratie-`INSERT` met `doc_level = 'tenant'` en `context_path = '/admin/storefront'`; één `content`-veld, geen taalvarianten |
| **Newsletter-wachtrij** | `docs/newsletter-queue.md`, onder **Openstaand**, met versienummer, categorie, datum en de i18n-key |

Per batch concreet:

- **5A** — grotendeels intern. Changelog-item alleen als de linkfix tenant-zichtbaar gedrag verandert (dat doet hij: kapotte knoppen gaan werken). Role-audit verplicht wegens aanraking van `ShopHome`.
- **5B** — tenant-zichtbaar, dus alle vier de slottaken. `doc_articles` over het werken met de nieuwe editor is hier het meest waardevol.
- **5C** — alle vier, met in de role-audit expliciet de gedeelde-paden-paragraaf over `storefront_pages.content`.

---

## 7. Open beslispunten

| ID | Vraag | Stand |
|---|---|---|
| **OB-F5-1** | WYSIWYG: bestaande renderers hergebruiken, of een aparte preview-render? | **De recon beantwoordt dit: hergebruiken, in React, zonder iframe.** De renderers hebben alleen een Router, een QueryClient en een `tenantId` nodig. Een iframe kan geen niet-opgeslagen state tonen zonder postMessage-brug, en de huidige tweelingen zijn juist de dure route. Ter bevestiging bij de 5A-recon. |
| **OB-F5-2** | Sectie-editor: `HomepageBuilder` uitbouwen of herbouwen? | **Open.** Voor uitbouwen pleit dat de lijstmodus, dnd-kit-sortering en `SectionEditor` (alle negen types) werken. Voor herbouwen pleit dat de twee modi naast elkaar rommelig zijn en de visual-modus grotendeels vervalt in 5B. Voorstel: beslissen bij de 5B-recon, wanneer de overlay-aanpak bewezen is. |
| **OB-F5-3** | `PreviewPanel` behouden naast het canvas? | Open. Hangt af van 5B; een "bekijk de echte pagina"-knop houdt waarde, een tweede preview naast een WYSIWYG-canvas niet. |
| **OB-F5-4** | Seed-normalisatie in 5A: alleen de drie template-rijen, of ook bestaande tenant-secties? | Voorstel: beide, want anders blijven twee conventies bestaan. Vereist een idempotente update; ter review bij de 5A-recon. |

---

## 8. Volgorde en afspraak

```
5A  Renderregister + resolveShopLink + linkfix + seeds        ← recon eerst
5B  WYSIWYG-canvas op het register, overlay-laag              ← recon eerst
5C  Editor-polish + opslagformaat                             ← EIGEN recon, ná 5B
```

Per batch geldt onverkort `CLAUDE.md` §3: **recon → review → expliciete go → implementatie → post-flight verificatie → paper trail.** Geen code vóór de go. Changelog en newsletter pas wanneer een batch 100% werkend en getest is op beide testbedden.
