
# Plan: Shopify Direct Connect Verbeteringen

## Problemen Geïdentificeerd

### 1. Store URL Input heeft Verkeerde Waarde
In de screenshot is te zien dat het veld "info@sellqo.ai" bevat - dit is jouw email adres dat waarschijnlijk door browser autofill is ingevuld. 

**Oorzaak**: Het input veld heeft geen `autoComplete="off"` attribuut, waardoor de browser het automatisch invult.

**Oplossing**: 
- Voeg `autoComplete="off"` toe aan de input
- Zorg dat de placeholder "mijn-winkel" duidelijk zichtbaar blijft

### 2. Visuele Documentatie met Screenshots
Gebruikers die niet technisch zijn hebben moeite om de tekst-instructies te volgen. Een visuele gids met screenshots zou veel helpen.

**Oplossing**:
- Maak een "Bekijk Handleiding" knop met informatiebolletje (HelpCircle icoon)
- Bij klikken opent een Dialog met stap-voor-stap screenshots
- Alternatief: Gebruik een carousel met annotated screenshots

## Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `ShopifyInstantConnect.tsx` | AutoComplete uitschakelen + Handleiding dialog toevoegen |
| `ShopifySetupGuide.tsx` (nieuw) | Component voor visuele documentatie modal |

## Technische Details

### 1. Fix AutoComplete
```tsx
<Input
  id="store-url"
  type="text"
  placeholder="mijn-winkel"
  autoComplete="off"
  value={storeUrl}
  ...
/>
```

### 2. Informatiebolletje + Dialog
Een knop naast "Stap 1" heading die een dialog opent met visuele instructies:

```text
┌──────────────────────────────────────────────────────────────────┐
│ [Badge: Stap 1] Maak een Custom App in Shopify  [?] Handleiding  │
└──────────────────────────────────────────────────────────────────┘
                                                    ↑
                                           Info button met icoon
```

De dialog bevat:
- Meerdere stappen met placeholder afbeeldingen (of beschrijvende tekst)
- Navigatie tussen stappen (carousel-stijl)
- Screenshots kunnen later worden toegevoegd

### 3. Visuele Gids Component Structuur
```tsx
// ShopifySetupGuide.tsx
const steps = [
  {
    title: "Ga naar Develop Apps",
    description: "Navigeer naar Settings → Apps → Develop apps",
    // Later: imageUrl of screenshot
  },
  {
    title: "Create an App",
    description: "Klik op 'Create an app' en noem het 'SellQo Connector'",
  },
  // ... meer stappen
];
```

## Screenshots Toevoegen (Toekomstig)
De component is voorbereid voor echte screenshots. Momenteel gebruiken we:
- Gestylede placeholder boxes met iconen
- Beschrijvende tekst per stap

Zodra je echte screenshots hebt, kunnen deze eenvoudig worden toegevoegd door:
1. Screenshots uploaden naar `public/images/shopify-guide/`
2. URLs toevoegen aan de `steps` array

## Resultaat
- Store URL veld blijft leeg (geen autofill)
- Placeholder "mijn-winkel" is zichtbaar
- Gebruikers kunnen visuele handleiding bekijken voor extra hulp
