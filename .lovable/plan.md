
## SEO dashboard blanco: echte oorzaak en gerichte fix

### Wat ik heb vastgesteld
Ik heb de code, database-structuur en live backenddata nagekeken. Voor VanXcel bestaat er wel degelijk SEO-data en analysehistoriek, dus het probleem is niet dat de analyse niets produceert. Het dashboard blijft blanco door een combinatie van backend save-fouten en leesrechten.

### Echte oorzaken

**1. SEO-data is aanwezig, maar de admin ziet ze niet**
- In `seo_scores` en `seo_analysis_history` bestaan records voor VanXcel
- De RLS policies op die tabellen gebruiken een directe check op `public.user_roles.tenant_id`
- Bij een platform admin / tenant switcher is die tenant-koppeling vaak niet aanwezig op de admin-role
- Daardoor krijgt de UI `tenantScore = null`, en blijven de cijfers + Quick Wins leeg

**2. Nieuwe tenant-level score wordt nog steeds niet correct opgeslagen**
- `ai-seo-analyzer` probeert de tenant-score op te slaan met `entity_id = null`
- In de live database is `seo_scores.entity_id` nog steeds `NOT NULL`
- De logs tonen expliciet:
  `null value in column "entity_id" of relation "seo_scores" violates not-null constraint`
- De functie logt die fout nu alleen, maar returned toch succes, waardoor het lijkt alsof analyse gelukt is terwijl de dashboardscore niet geüpdatet wordt

**3. Verkeerde taal-kolom in de edge function**
- De functie leest `tenants.primary_language`
- In de echte `tenants` tabel bestaat die kolom niet; daar is het `language`
- Dat maakt de analysecode fragiel en foutgevoelig

**4. Categorie-scores worden in de frontend uit de verkeerde dataset gehaald**
- `useSEO()` haalt momenteel enkel `entity_type = 'product'` op voor `productScores`
- `SEODashboard.tsx` probeert daar daarna ook categorie-scores uit te halen
- Daardoor blijven categorie-scoreweergaves fout of leeg

## Plan van aanpak

### 1. Database fix voor `seo_scores`
Maak een migratie die:
- `seo_scores.entity_id` nullable maakt
- bestaande tenant-level score rows normaliseert naar `entity_id = NULL`
- eventuele dubbele tenant-level rows veilig dedupliceert
- het bestaande partial unique index patroon behoudt voor:
  - tenant-level rows zonder `entity_id`
  - entity-level rows met `entity_id`

### 2. RLS fix voor SEO-tabellen
Pas de policies op `seo_scores` en `seo_analysis_history` aan zodat:
- tenant-toegang via `public.get_user_tenant_ids(auth.uid())` loopt
- platform admins ook leesrechten krijgen via `public.is_platform_admin(auth.uid())`

Zo kan een admin die naar VanXcel switcht de SEO-data effectief ophalen.

### 3. `ai-seo-analyzer` corrigeren
In `supabase/functions/ai-seo-analyzer/index.ts`:
- `tenants.language` gebruiken in plaats van `primary_language`
- tenant-score blijven opslaan via delete + insert met `entity_id = null`
- tenant-score save-fouten niet enkel loggen maar de request laten falen
- ook product/category/history inserts expliciet op fouten controleren

Zo vermijden we “schijnbaar succesvolle” analyses die het dashboard niet updaten.

### 4. Frontend dataflow opsplitsen
In `useSEO()`:
- aparte category score query toevoegen, of één gecombineerde score-query voor product + category

In `SEODashboard.tsx`:
- `categoriesWithSEO` koppelen aan echte category scores
- product- en categorie-overzichten elk hun juiste scorebron geven

### 5. Resultaat op dashboard
Na deze fixes:
- komen de cijfers bovenaan terug
- wordt `Quick Wins` opnieuw gevuld
- tonen categorieën hun echte scores
- worden nieuwe analyses correct opgeslagen én zichtbaar voor admins

## Bestanden
- `supabase/migrations/...` — nullable `entity_id`, cleanup, RLS-fix
- `supabase/functions/ai-seo-analyzer/index.ts` — taalveld + save/error handling
- `src/hooks/useSEO.ts` — category scores correct ophalen
- `src/pages/admin/SEODashboard.tsx` — juiste scoremapping

## Technische details
- Dit is geen polling- of laadprobleem
- De data bestaat al, maar wordt deels niet opgeslagen en deels niet gelezen door RLS
- De screenshot past exact bij `tenantScore = null`: top cards `--` en lege Quick Wins
