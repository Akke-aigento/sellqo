

## Mobile Banking Deep Link voor SEPA-betalingen

### Concept

Op mobiel heeft een QR-code geen zin — je kunt je eigen scherm niet scannen. De oplossing: het **`payto://` URI-scheme** (RFC 8905), een officieel internetstandaard die door de meeste Belgische en Nederlandse banking apps wordt ondersteund. 

Wanneer je op mobiel op een `payto://` link klikt, opent het besturingssysteem automatisch de banking app (of toont een keuzemenu als er meerdere zijn geinstalleerd). Alle betaalgegevens zijn dan al ingevuld — de klant hoeft alleen te bevestigen met Face ID, vingerafdruk of PIN.

```text
Desktop:                          Mobiel:
+------------------+              +------------------+
| [EPC QR-code]    |              | [Open bank-app]  |  <-- grote knop
|                  |              |   Face ID / PIN   |
| Scan met je      |              |                   |
| bank-app         |              | Of kopieer de     |
+------------------+              | gegevens hieronder|
| IBAN: BE68...    |              +------------------+
| Mededeling: +++  |              | IBAN: BE68...    |
+------------------+              | Mededeling: +++  |
                                  +------------------+
```

### Aanpak

**Responsive layout: QR op desktop, deep link op mobiel**

De twee componenten die SEPA-betaalinstructies tonen worden aangepast:

1. **`BankTransferPayment.tsx`** (bevestigingspagina na bestelling)
2. **`PlatformBankPaymentDialog.tsx`** (platform AI credits/add-ons)
3. **`POSBankTransferDialog.tsx`** (POS terminal - hier blijft QR, want het POS-scherm is altijd voor de handelaar, de klant scant)

Op **desktop**: alles blijft zoals het is (QR-code + handmatige gegevens).

Op **mobiel**: 
- QR-code wordt verborgen
- Grote primaire knop "Open je bank-app" verschijnt bovenaan
- Klikt de klant, dan opent `payto://iban/BE68539007547034?amount=EUR:49.95&message=+++090/9337/55493+++`
- Daaronder: de handmatige betaalgegevens met kopieer-knoppen als fallback (voor het geval de banking app het niet ondersteunt)
- Subtiele tekst: "Werkt met KBC, BNP Paribas Fortis, Belfius, ING, Argenta en meer"

### Technische details

**`payto://` URI formaat:**
```
payto://iban/{IBAN}?amount=EUR:{bedrag}&message={OGM-referentie}&receiver-name={begunstigde}
```

Voorbeeld:
```
payto://iban/BE68539007547034?amount=EUR:49.95&message=+++090/9337/55493+++&receiver-name=Loveke
```

Als de BIC bekend is, kan die ook in het pad:
```
payto://iban/KREDBEBB/BE68539007547034?amount=EUR:49.95&message=...
```

**Bestanden die worden aangepast:**

| Bestand | Wijziging |
|---|---|
| `src/lib/epcQrCode.ts` | Nieuwe functie `generatePaytoURI()` toevoegen die een `payto://` URI genereert op basis van dezelfde `EPCData` interface |
| `src/components/storefront/BankTransferPayment.tsx` | `useIsMobile()` hook gebruiken; op mobiel: QR verbergen, "Open je bank-app" knop tonen met `payto://` link; op desktop: bestaande QR layout behouden |
| `src/components/platform/PlatformBankPaymentDialog.tsx` | Zelfde mobiele aanpassing: QR verbergen op mobiel, deep link knop tonen |

**Nieuwe functie in `epcQrCode.ts`:**
```typescript
export function generatePaytoURI(data: EPCData): string {
  const iban = data.iban.replace(/\s/g, '').toUpperCase();
  const amount = `EUR:${data.amount.toFixed(2)}`;
  const params = new URLSearchParams();
  params.set('amount', amount);
  if (data.reference) params.set('message', data.reference);
  if (data.beneficiaryName) params.set('receiver-name', data.beneficiaryName);
  
  const bicPath = data.bic ? `${data.bic}/` : '';
  return `payto://iban/${bicPath}${iban}?${params.toString()}`;
}
```

**Mobiele layout in `BankTransferPayment.tsx`:**
- Import `useIsMobile` hook
- Genereer `paytoURI` via de nieuwe functie
- Op mobiel (`isMobile === true`):
  - Verberg het QR-code blok
  - Toon een grote knop met bank-icoon: `<a href={paytoURI}>` met `target="_self"`
  - Daaronder: fallback tekst "Opent niet? Kopieer de gegevens hieronder"
- Op desktop: bestaande layout ongewijzigd

**Fallback-strategie:**
Als het `payto://` scheme niet wordt ondersteund door de geinstalleerde banking app, gebeurt er simpelweg niets (de browser negeert het). Daarom staan de handmatige betaalgegevens met kopieer-knoppen er altijd onder als fallback.

