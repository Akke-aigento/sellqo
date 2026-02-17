

# EPC QR-code vergroten en correct positioneren

## Probleem

De QR-code wordt technisch correct gegenereerd met de juiste EPC-data (BIC, IBAN, bedrag, OGM), maar:

1. **Te klein om te scannen**: 80pt bij 37 modules = ~2pt per cel. Banking apps hebben minimaal ~3pt per cel nodig
2. **Verkeerde positionering**: de QR wordt getekend nadat yPos al volledig is verlaagd, waardoor hij te laag staat en mogelijk overlapt met de footer

## Oplossing

### `supabase/functions/generate-invoice/index.ts`

**Wijziging 1** - QR-code groter maken:
- Van `qrSize = 80` naar `qrSize = 110` (bij 37 modules = ~3pt per cel, goed scanbaar)

**Wijziging 2** - Sectie-hoogte aanpassen:
- `sectionHeight` verhogen naar `Math.max(120, qrSize + 30)` om ruimte te maken

**Wijziging 3** - QR-code positionering corrigeren:
- De QR-code rechts bovenin de betalingssectie plaatsen, uitgelijnd met de "Betalingsgegevens" titel
- `qrY` berekenen relatief aan de bovenkant van de sectie (niet aan de onderkant na alle tekst)

```text
Huidige layout:                    Nieuwe layout:
+---------------------------+      +---------------------------+
| Betalingsgegevens         |      | Betalingsgegevens  [QR]  |
| IBAN: BE41 7390 ...       |      | IBAN: BE41 7390    [QR]  |
| BIC: KREDBEBBXXX          |      | BIC: KREDBEBBXXX   [QR]  |
| Mededeling: +++002/...+++ |      | Mededeling: +++..  [QR]  |
| Scan de QR-code...        |      | Scan de QR-code... [QR]  |
|              [tiny QR]    |      +---------------------------+
+---------------------------+
```

**Wijziging 4** - Bewaar de yPos bovenkant voor QR-positionering:
- Sla de startpositie op voordat de betalingstekst wordt getekend
- Gebruik die als ankerpunt voor de QR-code

De EPC-data zelf is correct (BCD/002/1/SCT/BIC/naam/IBAN/bedrag/OGM) en hoeft niet te wijzigen.

## Resultaat

- QR-code is groot genoeg om betrouwbaar te scannen met elke banking app
- QR staat netjes rechts uitgelijnd naast de betalingsgegevens
- Bij het scannen opent de banking app met alle velden (IBAN, bedrag, mededeling) automatisch ingevuld
