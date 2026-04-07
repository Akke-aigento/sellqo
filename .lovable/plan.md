

## SEO Dashboard: scores fixen + Quick Wins actieknoppen

### Probleem 1: Sub-scores tonen `--`
De `seo_scores` tabel heeft een unique constraint op `(tenant_id, entity_type, entity_id)`. Voor tenant-level scores is `entity_id = NULL`. In PostgreSQL matcht `NULL != NULL`, waardoor de upsert **nooit** het bestaande record vindt. De eerste insert lukt, maar daarna faalt elke upsert stilletjes. Daarom toont het dashboard oude of geen data.

### Probleem 2: Quick Wins zijn passief
Issues tonen alleen tekst. Er zijn geen actieknoppen om direct iets te doen ("Genereer meta title", "Voeg afbeeldingen toe", etc.).

---

### Oplossing

**1. Database: unique constraint fixen voor NULL entity_id**

Vervang de bestaande constraint door een partial unique index die NULL entity_id correct afhandelt:

```sql
ALTER TABLE seo_scores DROP CONSTRAINT uq_seo_scores_tenant_entity;

CREATE UNIQUE INDEX uq_seo_scores_tenant_entity 
ON seo_scores (tenant_id, entity_type) 
WHERE entity_id IS NULL;

CREATE UNIQUE INDEX uq_seo_scores_tenant_entity_id 
ON seo_scores (tenant_id, entity_type, entity_id) 
WHERE entity_id IS NOT NULL;
```

En in de edge function: gebruik `.upsert(..., { onConflict: 'tenant_id,entity_type' })` wanneer `entity_id` null is.

**2. Quick Wins: actiegerichte knoppen per issue-type**

Elke Quick Win krijgt een duidelijke actieknop op basis van het issue-type:

| Issue type | Knop | Actie |
|---|---|---|
| `meta_title_missing/too_long` | "Genereer meta title" | Roept `generateContent('meta_title', [entityId])` aan |
| `meta_description_missing/too_long` | "Verbeter beschrijving" | Roept `generateContent('meta_description', [entityId])` aan |
| `images_missing` | "Ga naar product" | Navigeert naar product-edit pagina |
| `content_too_short` | "Genereer beschrijving" | Roept `generateContent('product_description', [entityId])` aan |
| Suggesties met `action` | Actieknop met label | Voert de actie uit |

De knoppen krijgen duidelijke labels ("Verbeter nu", "Genereer", "Bekijk product") en een primaire kleur bij hoge urgentie.

**3. Sub-scores met kleur-indicatie**

De 4 stat-cards bovenaan (Meta Score, Technisch, AI Search, Producten) krijgen een kleurindicatie: groen (≥70), oranje (50-70), rood (<50).

### Bestanden

| Bestand | Actie |
|---|---|
| Database migration | Unique constraint vervangen door partial indexes |
| `supabase/functions/ai-seo-analyzer/index.ts` | Upsert fix: aparte onConflict voor tenant vs entity scores |
| `src/components/admin/seo/SEOQuickWins.tsx` | Actiegerichte knoppen per issue-type met labels |
| `src/pages/admin/SEODashboard.tsx` | Kleur-indicatie op stat-cards, betere onAction handler |

