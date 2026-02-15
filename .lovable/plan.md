
# Live Preview en Storefront Achtergrondkleur Fix

## Probleem

De achtergrondkleur die je instelt (bijv. zwart `#0f0f0f` bij "Bold" mood) wordt wel opgeslagen in de database, maar verschijnt niet op de daadwerkelijke storefront. De oorzaak: het thema-systeem stelt de CSS-variabele `--background` correct in, maar de hoofdcontainer van de pagina past deze variabele niet toe.

De CSS-variabele wordt gezet op de wrapper div, maar die div heeft geen `bg-background` class, waardoor de browser gewoon de standaard witte achtergrond toont.

## Oplossing

Een simpele 1-regel fix: voeg `bg-background` toe aan de wrapper div in `ShopLayout.tsx`, zodat de Tailwind-class de `--background` CSS-variabele oppikt.

## Technische Wijziging

| Bestand | Wijziging |
|---------|-----------|
| `src/components/storefront/ShopLayout.tsx` | Regel 280: `bg-background` toevoegen aan de className van de wrapper div. |

Concreet:
- `"min-h-screen flex flex-col"` wordt `"min-h-screen flex flex-col bg-background"`

Dit zorgt ervoor dat de ingestelde achtergrondkleur (wit, zwart, of elke andere kleur) direct zichtbaar is op de hele pagina.
