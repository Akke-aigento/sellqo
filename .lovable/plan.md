

## Fix: SEO Analyzer crasht — `categories.meta_title` kolom bestaat niet

### Oorzaak
De `ai-seo-analyzer` edge function queryt `categories.meta_title` en `categories.meta_description`, maar deze kolommen bestaan niet. De `categories` tabel gebruikt taalspecifieke kolommen: `meta_title_nl`, `meta_title_en`, `meta_title_fr`, `meta_title_de` (en idem voor `meta_description`).

De `products` tabel heeft wél gewone `meta_title`/`meta_description` kolommen, dus die werkt correct.

### Oplossing

**`supabase/functions/ai-seo-analyzer/index.ts`**:

1. **Query aanpassen** (lijn 71): Vervang `meta_title, meta_description` door `meta_title_nl, meta_title_en, meta_title_fr, meta_title_de, meta_description_nl, meta_description_en, meta_description_fr, meta_description_de`

2. **Tenant taal ophalen**: Haal de primaire taal van de tenant op (`primary_language` uit `tenants` tabel) om de juiste kolom te gebruiken voor de analyse

3. **Analyse-logica aanpassen** (lijn 230-270): Gebruik `category.meta_title_nl` (of de taal van de tenant) in plaats van `category.meta_title` voor alle checks

### Concrete wijziging

```typescript
// Haal tenant primary_language op
const { data: tenant } = await supabase
  .from('tenants').select('primary_language').eq('id', tenantId).single();
const lang = tenant?.primary_language || 'nl';

// Categories query met taalspecifieke kolommen
.select(`id, name, description, meta_title_${lang}, meta_description_${lang}, slug, image_url, is_active`)

// In de analyse-loop:
const metaTitle = category[`meta_title_${lang}`];
const metaDesc = category[`meta_description_${lang}`];
```

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/ai-seo-analyzer/index.ts` | Categories query + analyse fixen voor taalspecifieke kolommen |

### Geen database wijzigingen nodig

