
# Klant niet gevonden: Tekst aanpassen en "Toevoegen" knop

## Wat verandert

### 1. Melding tekst aanpassen
De rode foutmelding op de klantdetailpagina (`src/pages/admin/CustomerDetail.tsx`, regel 59) wordt gewijzigd van:

> "Klant niet gevonden. Deze klant bestaat mogelijk niet meer."

naar:

> "Klant nog niet in klantenbestand of bestaat niet meer."

### 2. Knop toevoegen: "Toevoegen aan klantenbestand"
Onder de melding komt een knop waarmee je de klant direct kunt aanmaken. Dit werkt door:

- Het `customerId` uit de URL te parsen (dit bevat vaak het e-mailadres of naam-informatie)
- Een knop te tonen die de `CustomerSelectDialog` opent in "nieuwe klant"-modus, of direct een simpel formulier toont
- Na het aanmaken wordt de gebruiker doorgestuurd naar de nieuwe klantpagina

## Technische wijzigingen

### `src/pages/admin/CustomerDetail.tsx`

| Onderdeel | Wijziging |
|-----------|-----------|
| Foutmelding tekst (regel 59) | Tekst aanpassen naar nieuwe formulering |
| Foutmelding blok (regels 50-63) | Knop toevoegen onder de Alert met "Toevoegen aan klantenbestand" |
| Imports | `UserPlus` icoon toevoegen, `CustomerSelectDialog` importeren |
| State | `showCreateDialog` state toevoegen |
| Logica | Na aanmaken klant via dialog, navigeren naar de nieuwe klant-pagina |

De bestaande `CustomerSelectDialog` component wordt hergebruikt -- die heeft al een "Nieuwe klant aanmaken" formulier ingebouwd. De dialog opent direct in de "nieuwe klant"-modus zodat de gebruiker meteen kan invullen.
