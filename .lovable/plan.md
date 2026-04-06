

## Segment Builder uitbreiden + Template editor upgraden

### Probleem 1: Segmenten zijn te beperkt

De `customers` tabel heeft een `tags` kolom (text array) die nergens in de segment builder gebruikt wordt. Tags zoals "VIP", "Sleeping", "B2B Verified" etc. zijn niet selecteerbaar als filtercriterium. Ook ontbreken filters op nieuwsbrief-status en er is geen "heeft specifiek product gekocht" filter.

### Probleem 2: Template editor

Templates zijn beschikbaar via Marketing → tabblad "Templates". Maar de `TemplateDialog` heeft dezelfde beperking als de oude campagne-editor: puur een HTML textarea. Dit moet dezelfde visuele/HTML toggle krijgen als de campagne-editor.

### Oplossing

**1. SegmentBuilder uitbreiden met tags-filter**

In `SegmentBuilder.tsx`:
- Voeg een **Tags** filter toe — multi-select met de beschikbare tags van de tenant's klanten
- Haal bestaande tags op via een query (`SELECT DISTINCT unnest(tags) FROM customers WHERE tenant_id = ?`)
- Voeg een **Nieuwsbrief geabonneerd** toggle filter toe (ja/nee/alle)
- Voeg een **Aangemaakt sinds** datumfilter toe (nieuwe klanten targeten)

In `SegmentFilterRules` type (`src/types/marketing.ts`):
```typescript
tags?: string[];           // klant moet minstens één van deze tags hebben
tags_match?: 'any' | 'all'; // OF vs EN logica
email_subscribed?: boolean;
created_after?: string;    // ISO date
created_before?: string;
```

In `useCustomerSegments.ts` — de `useSegmentMemberCount` query uitbreiden:
- Tags filter: `query.overlaps('tags', selectedTags)` voor "any" match
- `email_subscribed` filter
- `created_at` range filters

Nieuwe hook `useCustomerTags` — haalt unieke tags op per tenant voor de dropdown.

**2. TemplateDialog upgraden met visuele editor**

In `TemplateDialog.tsx`:
- Voeg dezelfde visuele/HTML toggle toe als in `CampaignDialog`
- Hergebruik `CampaignRichEditor` voor de visuele modus
- Voeg email preview toe (iframe)
- Behoud beschikbare variabelen info

### Bestanden

| Bestand | Actie |
|---|---|
| `src/types/marketing.ts` | Tags, email_subscribed, created_after/before aan SegmentFilterRules |
| `src/components/admin/marketing/SegmentBuilder.tsx` | Tags multi-select, nieuwsbrief toggle, datumfilter |
| `src/hooks/useCustomerSegments.ts` | Query uitbreiden voor nieuwe filters |
| `src/hooks/useCustomerTags.ts` | Nieuw: unieke tags ophalen per tenant |
| `src/components/admin/marketing/TemplateDialog.tsx` | Visuele editor + HTML toggle + preview |

### Geen database wijzigingen nodig
De `tags` kolom en alle andere kolommen bestaan al.

