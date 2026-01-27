
# Fix Scroll Probleem in Onboarding Wizard

## Probleem Analyse

De onboarding wizard kan niet scrollen omdat:

1. De `ScrollArea` component met `flex-1` krijgt geen berekende hoogte
2. De parent `Card` heeft wel `max-h-[90vh]` maar mist `overflow-hidden`
3. De Radix ScrollArea Viewport kan daardoor niet bepalen wanneer te scrollen

## Oplossing

Een kleine aanpassing in `OnboardingWizard.tsx`:

### Wijziging 1: Card overflow toevoegen
Van:
```tsx
<Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
```

Naar:
```tsx
<Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
```

### Wijziging 2: ScrollArea min-height toevoegen
Van:
```tsx
<ScrollArea className="flex-1">
```

Naar:
```tsx
<ScrollArea className="flex-1 min-h-0">
```

De `min-h-0` is cruciaal voor flexbox containers - het overschrijft de default `min-height: auto` die voorkomt dat flex items kleiner worden dan hun content.

## Wat dit oplost

- Flexbox kan nu correct de hoogte berekenen voor de ScrollArea
- De Radix ScrollArea Viewport weet wanneer content overflowt
- Gebruikers kunnen scrollen om de "Volgende stap" button te zien

## Te wijzigen bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/onboarding/OnboardingWizard.tsx` | Voeg `overflow-hidden` toe aan Card en `min-h-0` aan ScrollArea |
