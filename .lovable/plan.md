

# Fix: Scrolling & Persistentie van AI Generaties

## Probleem 1: Niet kunnen scrollen
De container met de 3 variaties heeft een maximale hoogte (`max-h-60`), maar de PopoverContent zelf beperkt de zichtbare ruimte. Bij langere teksten past de inhoud niet in het venster en kun je niet scrollen.

**Oplossing**: De PopoverContent krijgt een `max-h-[70vh]` en een `ScrollArea` component zodat de hele inhoud scrollbaar wordt, ook bij langere gegenereerde teksten.

## Probleem 2: Generaties verdwijnen na selectie
Wanneer je op een variatie klikt, wordt de tekst toegepast maar worden alle variaties direct gewist uit het geheugen. Bij het heropenen van de popover zijn ze weg.

**Oplossing**: Bij het selecteren van een variatie wordt de tekst toegepast en de popover gesloten, maar de variaties blijven in het geheugen staan. Ze worden pas gewist als je expliciet op "Opnieuw genereren" klikt. De geselecteerde variatie wordt visueel gemarkeerd zodat je ziet welke je hebt gekozen.

---

## Technische Details

### Wijzigingen in `AIFieldAssistant.tsx`

1. **ScrollArea toevoegen** rond de variaties-lijst voor betrouwbaar scrollen
2. **`handleAccept` aanpassen**: Sluit de popover en past de tekst toe, maar wist `variations` en `result` NIET meer
3. **Geselecteerde variatie bijhouden** met een `selectedVariationId` state, zodat bij heropenen de gekozen variant visueel gemarkeerd is
4. **PopoverContent** krijgt `max-h-[70vh] overflow-hidden` en de binnenste content wordt in een ScrollArea gewrapt

| Wat | Hoe |
|---|---|
| Scroll fix | `ScrollArea` + `max-h-[70vh]` op PopoverContent |
| Persistentie | `handleAccept` wist geen state meer, alleen `handleRegenerate` doet dat |
| Visuele feedback | Geselecteerde variatie krijgt een vinkje/highlight |
| Bestand | `src/components/admin/ai/AIFieldAssistant.tsx` |

