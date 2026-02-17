
# Fix: "Omzetten naar bestelling" ook tonen bij concept-offertes

## Probleem

De knop "Omzetten naar bestelling" is alleen zichtbaar voor offertes met status `accepted` of `sent`. De offerte in de screenshot heeft status `draft` (Concept), waardoor de knop niet verschijnt.

## Oplossing

De conditie op regel 388 van `QuoteDetail.tsx` uitbreiden zodat de knop ook bij `draft`-status zichtbaar is:

**Bestand:** `src/pages/admin/QuoteDetail.tsx`

```text
Huidig:  (quote.status === 'accepted' || quote.status === 'sent') && !quote.converted_order_id
Nieuw:   (quote.status === 'draft' || quote.status === 'accepted' || quote.status === 'sent') && !quote.converted_order_id
```

Dat is de enige wijziging -- de rest van de conversielogica (order aanmaken, items kopieren, status updaten) werkt al ongeacht de offerte-status.
