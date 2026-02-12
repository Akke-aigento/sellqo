

# Documentatiesysteem met Twee Niveaus

## Overzicht

Een volledig in-app documentatiesysteem met twee gescheiden niveaus:
- **Tenant Docs**: Helpcenter voor winkel-eigenaren (alle gebruikers)
- **Platform Admin Docs**: Technische API- en ontwikkelaarsdocumentatie (alleen platform admins)

Content is bewerkbaar via een rich text editor, doorzoekbaar, en georganiseerd in categorieen.

---

## Database Structuur

Twee nieuwe tabellen:

### `doc_categories`
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | UUID PK | |
| doc_level | TEXT ('tenant' of 'platform') | Bepaalt zichtbaarheid |
| title | TEXT | Categorie naam |
| slug | TEXT | URL-vriendelijke naam |
| description | TEXT | Korte omschrijving |
| icon | TEXT | Lucide icon naam |
| sort_order | INT | Volgorde |
| parent_id | UUID (nullable, self-ref) | Subcategorieen |
| created_at / updated_at | TIMESTAMPTZ | |

### `doc_articles`
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | UUID PK | |
| category_id | UUID FK | Koppeling naar categorie |
| doc_level | TEXT ('tenant' of 'platform') | Redundant voor snelle RLS |
| title | TEXT | Artikel titel |
| slug | TEXT | URL-vriendelijke naam |
| content | TEXT | HTML content (TipTap) |
| excerpt | TEXT | Korte samenvatting voor zoekresultaten |
| tags | TEXT[] | Zoektags |
| context_path | TEXT (nullable) | Admin route voor contextual help (bijv. '/admin/products') |
| sort_order | INT | Volgorde binnen categorie |
| is_published | BOOLEAN | Draft/gepubliceerd |
| created_by | UUID | Auteur |
| updated_at | TIMESTAMPTZ | |

### RLS Policies
- **Tenant docs** (`doc_level = 'tenant'`): Leesbaar voor alle authenticated users; schrijfbaar alleen voor platform admins
- **Platform docs** (`doc_level = 'platform'`): Lees- EN schrijfbaar alleen voor platform admins
- Normale tenants zien nooit platform-level data -- niet via API, niet via UI

---

## Sidebar en Routing

### Tenant Help
- Nieuw item in de **Systeem** groep: "Help" met `HelpCircle` icoon
- Route: `/admin/help` (artikellijst) en `/admin/help/:slug` (artikel detail)
- Zichtbaar voor alle rollen

### Platform Admin Docs
- Nieuw item in de **Platform** groep: "Documentatie" met `BookOpen` icoon
- Route: `/admin/platform/docs` en `/admin/platform/docs/:slug`
- Beschermd via `ProtectedRoute requirePlatformAdmin`
- Onzichtbaar in sidebar voor niet-admins (bestaand `isPlatformAdmin` check)

---

## Pagina's en Componenten

### Gedeelde componenten (herbruikbaar voor beide niveaus)
- **`DocArticleViewer.tsx`**: Rendert artikel content, breadcrumbs, navigatie naar vorig/volgend artikel
- **`DocArticleEditor.tsx`**: TipTap rich text editor voor het aanmaken/bewerken van artikelen (hergebruik bestaande `RichTextEditor` component)
- **`DocSearchBar.tsx`**: Zoekbalk die filtert op titel, excerpt en tags
- **`DocCategoryList.tsx`**: Categorie-overzicht met artikelcount

### Tenant Help pagina (`/admin/help`)
- Linker kolom: categorieen met artikellijst
- Rechter kolom: geselecteerd artikel
- Zoekbalk bovenaan
- Geen bewerkfunctionaliteit voor tenants

### Platform Docs pagina (`/admin/platform/docs`)
- Zelfde layout als tenant help
- Extra: "Nieuw artikel" en "Bewerken" knoppen
- Extra: Categorie beheer (toevoegen/hernoemen/verwijderen)
- Extra tab-scheiding: "Tenant Docs beheren" vs "Platform Docs beheren"

### Contextual Help (nice-to-have, meegenomen in structuur)
- `context_path` kolom op artikelen maakt het mogelijk om later een `<ContextualHelpButton>` component te bouwen die op basis van de huidige route het relevante artikel ophaalt
- Wordt niet in eerste fase als UI gebouwd, maar de data-structuur is klaar

---

## Seed Data

Bij de migratie worden kernartikelen aangemaakt:

**Tenant categorieen en artikelen:**
1. Producten -- "Hoe voeg ik producten toe", "Varianten beheren"
2. Bestellingen -- "Bestellingen verwerken", "Retouren afhandelen"
3. Betalingen -- "Betaalmethode koppelen", "BTW instellen"
4. Verzending -- "Verzendopties instellen"
5. Promoties -- "Kortingscodes aanmaken"
6. Webshop -- "Theme aanpassen", "Domeinen instellen"
7. Communicatie -- "Inbox gebruiken"
8. FAQ -- "Veelgestelde vragen"

**Platform categorieen en artikelen:**
1. Storefront API Referentie -- "Endpoints overzicht", "Authenticatie", "Error codes"
2. Custom Frontend Gids -- "Startersgids", "Eerste Lovable prompt", "Checkout flow"
3. Domein & Deployment -- "DNS configuratie", "SSL setup"
4. Troubleshooting -- "API debugging", "Checkout testen"

---

## Bestanden die worden aangemaakt/gewijzigd

| Bestand | Actie |
|---------|-------|
| `supabase/migrations/XXXX.sql` | Tabellen, RLS, seed data |
| `src/pages/admin/Help.tsx` | Tenant help pagina |
| `src/pages/admin/PlatformDocs.tsx` | Platform docs pagina (met editor) |
| `src/components/admin/docs/DocArticleViewer.tsx` | Artikel weergave |
| `src/components/admin/docs/DocArticleEditor.tsx` | Artikel editor |
| `src/components/admin/docs/DocSearchBar.tsx` | Zoekfunctie |
| `src/components/admin/docs/DocCategoryList.tsx` | Categorie navigatie |
| `src/hooks/useDocumentation.ts` | Data fetching hook |
| `src/components/admin/sidebar/sidebarConfig.ts` | Help item toevoegen |
| `src/App.tsx` | Routes toevoegen |

---

## Technische Details

### Zoekfunctie
Client-side filtering op `title`, `excerpt` en `tags` via een simpele `ILIKE` query. Voor de huidige schaal is dit voldoende; full-text search kan later toegevoegd worden.

### Rich Text Editor
Hergebruik van de bestaande `RichTextEditor` component uit `src/components/admin/storefront/RichTextEditor.tsx`. Deze ondersteunt al bold, italic, headings, lijsten, links en afbeeldingen.

### Beveiligingsgarantie
- RLS op database-niveau: platform docs zijn onzichtbaar voor niet-admins, ongeacht welke URL ze proberen
- Route-niveau: `ProtectedRoute requirePlatformAdmin` wrapper
- Sidebar-niveau: platform groep wordt niet gerenderd voor niet-admins
- Geen client-side security checks -- alles server-side via `is_platform_admin(auth.uid())`

