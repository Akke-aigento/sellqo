

# Omgezette offertes verbergen in de offertelijst

## Aanpak

Standaard worden offertes met status `converted` uitgefilterd uit de lijst, zodat de lijst overzichtelijk blijft. Ze zijn nog steeds beschikbaar via het statusfilter "Omgezet" als je ze wilt terugvinden.

## Wijzigingen

### 1. `src/hooks/useQuotes.ts` - Query aanpassen

In de query die offertes ophaalt, een extra filter toevoegen: als er geen specifiek statusfilter is ingesteld, worden `converted` offertes uitgesloten.

```text
// Als statusFilter niet is ingesteld (of 'all'):
query = query.neq('status', 'converted')

// Als statusFilter WEL op 'converted' staat:
// Geen extra filter, dan worden ze juist getoond
```

### 2. `src/pages/admin/Quotes.tsx` - Geen wijziging nodig

Het statusfilter heeft al een "Omgezet" optie, dus gebruikers kunnen altijd bewust kiezen om omgezette offertes te bekijken.

## Resultaat

- Offertelijst toont standaard alleen actieve/relevante offertes
- Omgezette offertes zijn niet "weg" maar verborgen uit het standaardoverzicht
- Via het filter "Omgezet" zijn ze altijd terug te vinden
