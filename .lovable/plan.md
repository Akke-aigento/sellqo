
# Fix: "invalid input value for enum quote_status: rejected"

## Oorzaak

De bestelling wordt wel correct aangemaakt (vandaar dat je #1110 ziet in de bestellingenlijst), maar daarna faalt de status-update van de offerte naar `converted`.

Het probleem zit in de database trigger `handle_quote_notification` op de `quotes` tabel. Deze trigger bevat een CASE-statement dat de waarde `'rejected'` vergelijkt met de `quote_status` enum. Maar `rejected` bestaat niet als waarde in die enum -- de correcte waarde is `declined`.

PostgreSQL probeert `'rejected'` te casten naar het `quote_status` enum type, en dat mislukt met de fout die je ziet.

## Oplossing

In de database-functie `handle_quote_notification` de CASE-waarde `'rejected'` wijzigen naar `'declined'`:

```text
Huidig:   WHEN 'rejected' THEN
Nieuw:    WHEN 'declined' THEN
```

De bijbehorende notification type blijft `quote_rejected` (dat is een string, geen enum).

## Impact

- De conversie van offerte naar bestelling zal direct werken zonder foutmelding
- Notificaties bij afgewezen offertes zullen ook correct worden aangemaakt (nu werden ze ook al niet verstuurd door dezelfde fout)
- Geen verdere code-wijzigingen nodig -- de frontend-code is correct
