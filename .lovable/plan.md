
# Beschrijving editor inklapbaar maken

## Wat verandert er
Het "Volledige beschrijving" veld met de rich text editor wordt ingepakt in een **Collapsible** component. Standaard staat het dichtgeklapt zodat het formulier compact blijft, en met een klik klap je het open om de volledige editor te zien op dezelfde grootte als nu.

## Aanpak
- Wrap het `FormField` voor `description` in een `Collapsible` van Radix UI (al beschikbaar in `src/components/ui/collapsible.tsx`)
- De `FormLabel` "Volledige beschrijving" wordt de `CollapsibleTrigger` met een chevron-icoontje dat draait bij open/dicht
- De `ProductDescriptionEditor` zit in de `CollapsibleContent`
- Standaard dichtgeklapt (`defaultOpen={false}`)

## Technische details

| Bestand | Actie |
|---------|-------|
| `src/pages/admin/ProductForm.tsx` | Wrap description FormField in `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent` |

Geen nieuwe dependencies of componenten nodig -- `Collapsible` is al beschikbaar in het project.
