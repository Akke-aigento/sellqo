
# Auto-generatie SEO bij beschrijving

## Wat verandert er?
Wanneer je een productbeschrijving genereert via de AI-assistent, worden de **meta titel** en **meta beschrijving** automatisch mee gegenereerd in dezelfde actie. Je hoeft dus niet apart nog op het SEO-knopje te klikken. De SEO-velden worden direct ingevuld. Wil je ze later toch aanpassen? Dat kan nog steeds via de losse SEO-knoppen.

## Hoe werkt het?

1. Gebruiker klikt op het AI-icoon bij de beschrijving
2. AI genereert de beschrijving (zoals nu)
3. In dezelfde AI-call worden ook meta titel en meta beschrijving mee gegenereerd
4. De beschrijving wordt in de editor gezet (zoals nu), en de SEO-velden worden automatisch ingevuld
5. Een toast meldt: "Beschrijving + SEO gegenereerd"

---

## Technische Details

### Edge function: `supabase/functions/ai-product-field-assistant/index.ts`

Wanneer `fieldType === "description"`, wordt de AI-prompt aangepast om naast de beschrijving ook SEO-velden te genereren:

- De prompt krijgt een extra instructie: "Genereer ook een meta_title (max 60 tekens) en meta_description (max 160 tekens)"
- Het antwoordformaat wordt JSON: `{ "description": "...", "meta_title": "...", "meta_description": "..." }`
- Dit geldt voor zowel `auto_generate`, `briefing_generate` als `generate_variations`
- Bij variaties bevat elke variant ook een `meta_title` en `meta_description`
- De respons krijgt een nieuw veld `seo` met de gegenereerde SEO-data

### Component: `src/components/admin/ai/AIFieldAssistant.tsx`

- Nieuwe optionele prop: `onSeoGenerated?: (seo: { meta_title: string; meta_description: string }) => void`
- Na ontvangst van data met `seo` veld, roept het component `onSeoGenerated` aan met de SEO-data
- De bestaande `onApply` flow blijft ongewijzigd

### Component: `src/components/admin/products/ProductDescriptionEditor.tsx`

- Nieuwe optionele prop: `onSeoGenerated?: (seo: { meta_title: string; meta_description: string }) => void`
- Wordt doorgegeven aan de `AIFieldAssistant`

### Pagina: `src/pages/admin/ProductForm.tsx`

- Geeft een `onSeoGenerated` callback mee aan `ProductDescriptionEditor`:
```
onSeoGenerated={(seo) => {
  form.setValue('meta_title', seo.meta_title);
  form.setValue('meta_description', seo.meta_description);
  toast.success('SEO meta titel en beschrijving automatisch ingevuld');
}}
```

### Geen extra credits
De SEO wordt mee gegenereerd in dezelfde AI-call, dus er worden geen extra credits verbruikt. De max_tokens voor beschrijvingen wordt licht verhoogd (van 1500 naar 2000) om ruimte te bieden voor de extra SEO-tekst.

| Bestand | Wijziging |
|---|---|
| `ai-product-field-assistant/index.ts` | Prompt uitbreiden voor SEO bij description, JSON response format |
| `AIFieldAssistant.tsx` | Nieuwe `onSeoGenerated` prop, SEO-data doorgeven |
| `ProductDescriptionEditor.tsx` | `onSeoGenerated` prop doorlussen |
| `ProductForm.tsx` | SEO callback koppelen aan form.setValue |
