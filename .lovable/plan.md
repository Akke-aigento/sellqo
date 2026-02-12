
# Drie verbeteringen: Briefing scrollen, resultaten onthouden, SEO + beschrijving

## 1. Briefing-veld scrollbaar maken
Het textarea in de popover heeft `resize-none` en maar 3 regels. Bij langere teksten kun je niet scrollen. 

**Oplossing**: Verander het textarea naar `rows={4}` met `resize-y` en voeg `max-h-[40vh] overflow-y-auto` toe aan de briefing tab-content zodat het hele paneel scrollbaar is bij langere teksten.

## 2. Gegenereerde resultaten onthouden
Na het sluiten van de resultaten-dialog worden `result` en `variations` gewist bij de volgende generatie (regel 103-104). Als je de dialog sluit zonder te accepteren, zijn de resultaten weg.

**Oplossing**: Bewaar het vorige resultaat. Verwijder het wissen van `result`/`variations` aan het begin van `generate()`. Ze worden sowieso overschreven wanneer nieuwe data binnenkomt. Daarnaast: bij het opnieuw openen van de popover (klik op sparkles), toon een "Bekijk vorig voorstel" knop als er nog een resultaat beschikbaar is.

## 3. SEO generatie gebruikt de beschrijving als context
Het edge function ontvangt de beschrijving via `productContext.description`, maar gebruikt alleen `short_description` in de prompt. Wanneer je een SEO meta-titel of meta-beschrijving genereert, moet de AI ook de volledige beschrijving kennen om relevante SEO-teksten te schrijven.

**Oplossing**: Voeg `ctx.description` toe aan het PRODUCT CONTEXT blok in de edge function. Beperk het tot de eerste 500 tekens om het prompt-budget niet te overschrijden.

---

## Technische Details

### `src/components/admin/ai/AIFieldAssistant.tsx`

**Briefing scrollbaar:**
- Regel 233: Verander `resize-none` naar `resize-y` en voeg `max-h-32` toe
- Regel 227: Voeg `max-h-[50vh] overflow-y-auto` toe aan de briefing TabsContent

**Resultaten onthouden:**
- Regel 103-104: Verwijder `setResult(null)` en `setVariations([])` uit de `generate` functie
- Voeg een "Bekijk vorig voorstel" knop toe in de popover (auto tab) die de dialog opent als er nog een `result` of `variations` beschikbaar is
- Verplaats het wissen naar wanneer er daadwerkelijk nieuw data binnenkomt (de bestaande code op regel 121-124 overschrijft ze al)

### `supabase/functions/ai-product-field-assistant/index.ts`

**SEO + beschrijving context:**
- Na regel 157 (`ctx.short_description`): voeg toe:
```typescript
if (ctx.description) {
  const descPlain = ctx.description.replace(/<[^>]*>/g, '').substring(0, 500);
  systemParts.push(`- Beschrijving: ${descPlain}`);
}
```
Dit stript de HTML-tags en beperkt tot 500 tekens zodat de prompt niet te lang wordt.

| Bestand | Wijziging |
|---|---|
| `AIFieldAssistant.tsx` | Briefing scrollbaar, resultaten onthouden met "Bekijk voorstel" knop |
| `ai-product-field-assistant/index.ts` | Beschrijving meesturen als SEO-context |
