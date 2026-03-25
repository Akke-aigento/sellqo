
Doel: SEO-module direct werkend maken (analyse + bulk generatie), zodat je effectief kunt optimaliseren i.p.v. vastlopen.

1) Blokkerende backend-fout oplossen (root cause)
- Gevonden in logs: `ai-seo-analyzer` faalt op `categories.meta_title` (kolom bestaat niet).
- In jullie database heeft `categories` enkel `meta_title_nl/en/de/fr` en `meta_description_nl/en/de/fr`.
- Aanpak in `supabase/functions/ai-seo-analyzer/index.ts`:
  - Categorie-query aanpassen naar bestaande kolommen.
  - Normalisatie toevoegen: interne `meta_title`/`meta_description` mappen op tenant-taal (fallback `nl`).
  - Analyse laten doorgaan op genormaliseerde velden.
  - Fouten bij opslag niet alleen loggen maar request laten falen met duidelijke error (zodat UI niet “vals succes” toont).

2) SEO-score opslag betrouwbaar maken (nu structureel fragiel)
- `seo_scores` heeft geen unieke constraint op `(tenant_id, entity_type, entity_id)`, terwijl de functie hierop upsert.
- Database-migratie toevoegen:
  - Tenant-scores backfillen naar niet-lege `entity_id` (bijv. `tenant_id`) voor consistente conflict-key.
  - Unieke index/constraint toevoegen op `(tenant_id, entity_type, entity_id)`.
- Daarna in analyzer-upserts dezelfde conflict-key consequent gebruiken.

3) Generatie-flow voor categorieën fixen
- `supabase/functions/ai-generate-seo-content/index.ts` gebruikt nu ook niet-bestaande categorievelden.
- Aanpak:
  - Category select/update omzetten naar meertalige velden.
  - Zelfde taal-resolutie als analyzer gebruiken.
  - Bij category generatie juiste doelkolom schrijven (`meta_title_<lang>`, `meta_description_<lang>`, `description`).
  - Preview-flow behouden, maar met correcte veldmapping.

4) Frontend SEO-tab functioneel maken met echte data
- `src/components/admin/seo/SEOOptimizeTab.tsx`
  - Categorie SEO-status nu correct lezen uit meertalige velden i.p.v. `meta_title/meta_description`.
  - Na “toepassen” relevante queries invalideren (`products`, `categories`, `seo-score`, `seo-product-scores`) zodat UI direct refreshed.
  - Generatie-oproep per entiteitstype blijft, maar met robuuste foutmelding per stap.
- `src/hooks/useSEO.ts`
  - Scores-query uitbreiden zodat zowel product als category scores beschikbaar zijn (nu alleen product).
- `src/pages/admin/SEODashboard.tsx`
  - Foutstate bij analyse expliciet tonen (niet alleen toast), met bruikbare melding.

5) Kleine type-alignments (stabiliteit)
- `src/types/product.ts`: `Category` uitbreiden met meertalige SEO-velden.
- `src/hooks/useTenant.tsx`: `Tenant` type uitbreiden met `language` (nu wordt dit met casts omzeild).
- Dit verwijdert `any`/`ts-expect-error`-workarounds in SEO-paden.

6) Validatie na implementatie (end-to-end)
- Scenario A: “AI Analyse starten” op SEO dashboard → geen 500, score wordt opgeslagen en zichtbaar.
- Scenario B: Optimaliseer-tab:
  - Producten + categorieën selecteren
  - Preview genereren
  - Selectief toepassen
  - Direct geüpdatete waarden zichtbaar na refresh.
- Scenario C: Herhaalde analyse overschrijft dezelfde score-records (geen duplicaten in `seo_scores`).

Bestanden die aangepast worden
- `supabase/functions/ai-seo-analyzer/index.ts`
- `supabase/functions/ai-generate-seo-content/index.ts`
- Nieuwe SQL migratie voor `seo_scores` uniqueness/backfill
- `src/components/admin/seo/SEOOptimizeTab.tsx`
- `src/hooks/useSEO.ts`
- `src/pages/admin/SEODashboard.tsx`
- `src/types/product.ts`
- `src/hooks/useTenant.tsx`
