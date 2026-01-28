

# Fix: Scroll Probleem in Onboarding Wizard

## Probleem Analyse

Op het "Kies je plan" scherm (Stap 2 van 7) kan de gebruiker niet scrollen om de Pro en Enterprise plannen volledig te zien.

### Root Cause

De `ScrollArea` component van Radix UI werkt alleen correct wanneer:
1. De parent container een **vaste hoogte** heeft
2. De Viewport correct is geconfigureerd voor overflow

In de huidige implementatie:
- De `Card` heeft `max-h-[90vh]` en `flex flex-col`
- De `ScrollArea` heeft `flex-1 min-h-0`
- Maar de Radix `ScrollAreaPrimitive.Viewport` heeft alleen `h-full w-full` zonder de juiste overflow constraints

Het probleem is dat de flex container de hoogte niet correct doorgeeft aan de ScrollArea Viewport.

## Oplossing

We passen de `OnboardingWizard.tsx` aan om de scroll correct te laten werken:

### Aanpak 1: Expliciete hoogte op ScrollArea (Aanbevolen)

In plaats van te vertrouwen op `flex-1`, geven we de ScrollArea een expliciete `max-height` en gebruiken we `overflow-y-auto` als fallback:

```
Huidige code (regel 224):
<ScrollArea className="flex-1 min-h-0">

Nieuwe code:
<ScrollArea className="flex-1 min-h-0 max-h-[calc(90vh-180px)]">
```

De `180px` compenseert voor:
- Header (~56px)
- Progress indicator (~100px met padding)
- Extra marge (~24px)

### Aanpak 2: Alternative - Native overflow

Als backup kunnen we de ScrollArea vervangen door een simpele div met native scroll:

```
<div className="flex-1 min-h-0 overflow-y-auto">
  <CardContent className="p-6">
    ...
  </CardContent>
</div>
```

## Implementatie Details

We kiezen voor Aanpak 1 (Radix ScrollArea behouden) omdat:
- Consistent met de rest van de UI
- Mooiere scrollbar styling
- Beter cross-browser gedrag

### Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `src/components/onboarding/OnboardingWizard.tsx` | ScrollArea krijgt expliciete `max-h-[calc(90vh-180px)]` |

## Verwacht Resultaat

- Gebruikers kunnen door alle 4 de plannen scrollen
- De scrollbar wordt zichtbaar wanneer content de beschikbare ruimte overschrijdt
- Werkt consistent op desktop en mobile viewports

