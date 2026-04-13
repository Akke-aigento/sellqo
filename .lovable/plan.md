

# Inline voorraad aanpassen per variant met één klik

## Probleem
Om de voorraad van een variant aan te passen moet je nu op "Bewerken" klikken, het voorraadveld wijzigen, en dan op "Opslaan" klikken — 3 stappen. Dit moet sneller.

## Oplossing

Maak het voorraadgetal in zowel de mobiele card-layout als de desktop-tabel **direct klikbaar** met +/- knoppen, zonder dat je in edit-modus hoeft te gaan.

### Wijziging: `src/components/admin/products/ProductVariantsTab.tsx`

**Inline stock stepper component** toevoegen (binnen hetzelfde bestand):
- Toon het huidige voorraadgetal met een **–** knop links en een **+** knop rechts
- Elke klik op +/– roept direct `updateVariant.mutate({ id, data: { stock: variant.stock ± 1 } })` aan — opslaan in één klik
- Het getal zelf is klikbaar om een exacte waarde in te typen (inline input die bij Enter/blur opslaat)
- Vervangt de statische `<span>{variant.stock}</span>` in zowel de mobiele grid (regel ~397-399) als de desktop tabel

**Visuele weergave:**
```text
  Voorraad
  [ – ]  12  [ + ]
```

### Wat er niet verandert
- De volledige edit-modus (Pencil-knop) blijft bestaan voor prijs, SKU, actief-status
- Geen database- of API-wijzigingen nodig
- Geen nieuwe dependencies

