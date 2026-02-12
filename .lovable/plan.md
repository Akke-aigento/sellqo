

# Multi-Domain Support per Tenant

## Overzicht

Elke tenant krijgt de mogelijkheid om meerdere domeinen te koppelen aan dezelfde webshop. Elk domein heeft een eigen taalinstelling en er is altijd precies 1 canonical domein voor SEO. De bestaande producten, orders, klanten en voorraad worden gedeeld -- alleen de content-taal en SEO-metadata verschillen per domein.

## Wat er gebouwd wordt

### 1. Database: `tenant_domains` tabel

Nieuwe tabel met de volgende kolommen:

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | uuid (PK) | Uniek ID |
| tenant_id | uuid (FK -> tenants) | Koppeling aan tenant |
| domain | text (unique) | Het domein (bv. vanxcel.be) |
| locale | text | Taal/locale (nl, en, de, fr) |
| is_canonical | boolean | Hoofddomein voor SEO (max 1 per tenant) |
| is_active | boolean | Of het domein actief is |
| dns_verified | boolean | Of DNS geverifieerd is |
| verification_token | text | Token voor DNS verificatie |
| ssl_active | boolean | SSL status |
| created_at | timestamptz | Aanmaakdatum |
| updated_at | timestamptz | Laatste wijziging |

- Unique constraint op `domain`
- Unique partial index: slechts 1 `is_canonical = true` per `tenant_id`
- RLS policies: tenant_admin kan eigen domeinen beheren
- DB trigger: bij `is_canonical = true` zet alle andere domeinen van die tenant op `is_canonical = false`

### 2. Database: Migratie bestaande domeindata

De huidige `custom_domain` en `domain_verified` kolommen op de `tenants` tabel blijven bestaan voor backwards-compatibiliteit, maar nieuwe domeinen worden in `tenant_domains` beheerd. Eventueel bestaande `custom_domain` waarden worden bij eerste gebruik gemigreerd.

### 3. Dashboard: "Domeinen" sectie in Settings

Een nieuw component `MultiDomainSettings` dat de bestaande `DomainSettings` aanvult/vervangt in de Settings pagina:

- **Overzichtstabel** met alle gekoppelde domeinen (domein, taal, canonical-badge, status)
- **Domein toevoegen**: formulier met domein-input, taalselectie, canonical toggle
- **Domein bewerken**: taal wijzigen, canonical status wijzigen
- **Domein verwijderen**: met bevestigingsdialoog
- DNS verificatie-status per domein (hergebruikt bestaande verificatielogica)

### 4. Producten: Vertalingen via tabs in ProductForm

In het productformulier komt een taaltab-systeem voor de vertaalbare velden:

- Tabs gebaseerd op de actieve talen van de gekoppelde domeinen van de tenant
- Per tab: `name`, `description`, `short_description`, `meta_title`, `meta_description`
- Gebruikt de bestaande `content_translations` tabel -- geen nieuw schema nodig
- De standaardtaal-tab toont de gewone productvelden (geen vertaalrecord)
- Andere talen slaan op via `content_translations` met `entity_type = 'product'`
- Fallback: als geen vertaling bestaat, wordt de standaardtaal getoond

### 5. Storefront API: Domain-aware content

De `usePublicStorefront` hook wordt uitgebreid:

- Nieuwe functie `usePublicStorefrontByDomain(hostname)` die:
  1. Het domein opzoekt in `tenant_domains`
  2. De bijbehorende tenant en locale teruggeeft
  3. Productcontent in de juiste taal serveert (via `content_translations`)
- Fallback naar standaard tenant-taal als vertaling ontbreekt

SEO-metadata:
- Canonical URL op basis van het `is_canonical` domein
- Hreflang tags genereren voor alle actieve domeinen van de tenant
- Meta title/description in de juiste taal

### 6. Hook: `useTenantDomains`

Nieuwe hook voor CRUD-operaties op `tenant_domains`:

- `domains`: lijst van alle domeinen voor huidige tenant
- `addDomain(domain, locale, isCanonical)`
- `updateDomain(id, updates)`
- `removeDomain(id)`
- Automatische query-invalidatie

## Technische details

### Bestanden die aangemaakt worden

| Bestand | Beschrijving |
|---------|-------------|
| `src/hooks/useTenantDomains.ts` | CRUD hook voor tenant_domains |
| `src/components/admin/settings/MultiDomainSettings.tsx` | Dashboard UI voor domeinbeheer |
| `src/components/admin/products/ProductTranslationTabs.tsx` | Taaltabs in productformulier |

### Bestanden die gewijzigd worden

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/admin/Settings.tsx` | Domain sectie vervangen door MultiDomainSettings |
| `src/pages/admin/ProductForm.tsx` | ProductTranslationTabs toevoegen |
| `src/hooks/usePublicStorefront.ts` | Domain-aware lookup + hreflang/canonical toevoegen |

### Database migratie

- Nieuwe tabel `tenant_domains` met RLS
- Trigger voor `ensure_single_canonical_domain`
- Index op `tenant_id` en `domain`

### Volgorde van implementatie

1. Database migratie (`tenant_domains` tabel + RLS + trigger)
2. `useTenantDomains` hook
3. `MultiDomainSettings` component in dashboard
4. `ProductTranslationTabs` component in productformulier
5. Storefront API aanpassingen (domain-aware queries, hreflang, canonical)

