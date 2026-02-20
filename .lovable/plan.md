
# Klant direct aanmaken vanuit gesprek (inbox)

## Huidige situatie

De functionaliteit bestaat **al** in de inbox (`ConversationDetail.tsx`):
- Als een gesprek geen gekoppelde klant heeft, verschijnt er een "Maak klant aan" knop
- Deze maakt de klant direct aan met naam, email en telefoon uit het gesprek -- zonder extra formulier
- Klanten die een order plaatsen worden al automatisch aangemaakt

## Wat nog verbeterd kan worden

### 1. CustomerDetail-pagina: slimmere fallback
Op de klantdetailpagina (wanneer iemand via een link met een onbekend UUID terechtkomt) zoeken we in de `customer_messages` tabel naar berichten die aan dat `customer_id` gekoppeld zijn. Als we daar een `from_email` vinden, maken we de klant direct aan met die gegevens.

**Wijziging in `src/pages/admin/CustomerDetail.tsx`:**
- Query `customer_messages` op `customer_id` om `from_email` op te halen
- Als er data is: knop toont "Toevoegen: naam@email.nl" en maakt met 1 klik de klant aan
- Als er geen data is: toon de huidige `CustomerSelectDialog` als fallback
- Verwijder de dialoog-stap wanneer automatisch aanmaken mogelijk is

### 2. Geen wijzigingen nodig in de inbox
De inbox-flow in `ConversationDetail.tsx` werkt al correct: de "Maak klant aan" knop maakt de klant direct aan als prospect met de beschikbare gegevens (email, naam, telefoon) zonder extra handelingen.

## Technische details

### `src/pages/admin/CustomerDetail.tsx`

| Stap | Actie |
|------|-------|
| Query toevoegen | `customer_messages` opvragen met `customer_id` filter, `from_email` en eventueel naam uit `context_data` extraheren |
| Knop aanpassen | Bij beschikbare data: directe `createCustomer` aanroep (geen dialoog) |
| Fallback | Bij geen data: `CustomerSelectDialog` behouden |
| Na aanmaken | Automatisch navigeren naar nieuw klantprofiel |
