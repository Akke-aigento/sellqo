# Audit: /shop/:tenantSlug/legal/:pageType — Juridische pagina
Pinned SHA: `03781985` · Datum: 2026-09-02 · Assen: A–G · Laag 1 (statisch)
Bestand: `src/pages/storefront/ShopLegalPage.tsx (100 r.)`
Gedeelde bevindingen: `01-storefront-gedeeld.md` (S-1 t/m S-6) — gelden ook hier.

## Verdict-samenvatting
🔴 1 · 🟡 1 · 🟢 2

## Bevindingen

### 🔴 E1 — Juridische pagina's tonen altijd Nederlands, ook in een anderstalige winkel
- **Wat:** titel, meta-beschrijving, broodkruimel en de volledige inhoud komen uit de `_nl`-kolommen, ongeacht de taal van de winkel of de bezoeker.
- **Waar:** vier vaste `_nl`-verwijzingen in `src/pages/storefront/ShopLegalPage.tsx` — `:43` (`title_nl` in de `<title>`), `:45` (`meta_description_nl`), `:61` (broodkruimel), `:80` (`<h1>`) en `:88`:
  ```tsx
  dangerouslySetInnerHTML={{ __html: legalPage.content_nl || '' }}
  ```
  Plus `src/components/storefront/ShopLayout.tsx:424`, waar de footerlinks `page.title_nl` tonen — gevoed door `usePublicStorefront.ts:251`, dat alléén `id, page_type, title_nl` ophaalt.
- **Root cause:** de tabel `legal_pages` heeft wel degelijk `title_nl/_en/_de/_fr` en `content_nl/_en/_de/_fr` (zichtbaar in de migraties), en de tenant-admin schrijft ze ook — `src/hooks/useLegalPages.ts:108-109` zet `title_nl` én `title_en` weg. Alleen de publieke kant leest de vertalingen nooit.
- **Gevolg:** een Duitse of Franse klant krijgt Nederlandse algemene voorwaarden en een Nederlands privacybeleid. Vertaalwerk dat de tenant al betaald en ingevoerd heeft, ligt ongebruikt in de database. Voor juridische documenten in een consumentenwinkel is dat ook een nalevingskwestie.
- **Verband:** dit is S-1 in z'n scherpste vorm — de klant kan wel op Frans klikken, maar krijgt Nederlands recht voorgeschoteld.
- **Fixrichting:** kolomkeuze afleiden uit de actieve winkeltaal met terugval op `_nl`, en `usePublicStorefront.ts:251` de vier titelkolommen laten ophalen. **Platform:** CC. **Frozen-path-risico:** nee — `legal_pages` is geen gedeelde storefront-tabel en dit is puur leesgedrag.

### 🟡 D1 — Wie mag `legal_pages.content_*` schrijven? (XSS-oppervlak)
`:88` zet de inhoud ongesanitiseerd via `dangerouslySetInnerHTML` op een publieke winkelpagina. Wie die kolom kan schrijven, kan script uitvoeren bij elke bezoeker van die winkel. Zelfde klasse als 🟡 D-3 uit run 0, maar tenant-gescopeerd.
```sql
SELECT polname, polcmd,
       pg_get_expr(polqual, polrelid)      AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check
FROM pg_policy WHERE polrelid = 'public.legal_pages'::regclass;

SELECT relrowsecurity FROM pg_class WHERE oid = 'public.legal_pages'::regclass;
```
**Verwacht bij "veilig":** RLS aan, schrijven alleen binnen de eigen `tenant_id` en alleen voor rollen die de winkel toch al beheren.

## 🟢 Geverifieerd correct
1. **Alleen gepubliceerde pagina's zijn zichtbaar.** `:29` filtert op `.eq('is_published', true)` naast `tenant_id` en `page_type` — concepten lekken niet naar het publiek.
2. **Ontbrekende pagina geeft een nette boodschap**, geen wit scherm (`:92-96`) — anders dan de platform-variant `SellqoLegal` uit 🔴 V-1 in run 0.
