

## Fix: Build error + QR EPC payload

### Twee problemen

**1. Build error: `process-refund` deploy faalt**
`supabase/functions/process-refund/index.ts` regel 3 gebruikt `npm:@supabase/supabase-js@2.57.2` — een npm-specifier die niet werkt in de edge runtime zonder een `deno.json` of `package.json` met die dependency. Moet een esm.sh import worden, consistent met de andere functions.

**2. QR EPC payload: structuur fout**
De tenant data (iban, bic, name) wordt wél correct opgehaald uit de database — de `SELECT` bevat alle velden en de DB heeft waarden voor VanXcel. Het probleem zit in de **payload structuur** op regel 1720:

```
BCD\n002\n1\nSCT\n${bic}\n${name}\n${iban}\nEUR${amount}\n\n${ref}\n\n
```

Dit produceert slechts 11 regels. Het bestelnummer (`ref`) staat op **regel 10** (Structured Reference) in plaats van **regel 11** (Unstructured Remittance). Regel 12 ontbreekt. Bankapps interpreteren de structured reference anders dan vrije tekst — sommige verwachten ISO 11649 formaat en negeren het veld als het niet klopt.

### Fix

**`supabase/functions/process-refund/index.ts`** — regel 3:
```typescript
// VAN:
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
// NAAR:
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
```

**`supabase/functions/storefront-api/index.ts`** — regel 1719-1720:
Vervang de template literal door een array met expliciete 12 regels:

```typescript
const qrPayload = [
  "BCD",                          // 1: Service Tag
  "002",                          // 2: Version
  "1",                            // 3: UTF-8
  "SCT",                          // 4: SEPA Credit Transfer
  bic,                            // 5: BIC
  name,                           // 6: Beneficiary Name
  iban.replace(/\s/g, ''),        // 7: IBAN zonder spaties
  `EUR${Number(amount).toFixed(2)}`, // 8: Amount
  "",                             // 9: Purpose (leeg)
  "",                             // 10: Structured Reference (leeg)
  ref,                            // 11: Unstructured Remittance (bestelnummer)
  "",                             // 12: Display text (leeg)
].join("\n");
```

Plus een debug log ervoor:
```typescript
console.log('QR EPC payload data:', { iban, bic, name, amount, ref });
```

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/process-refund/index.ts` | Fix npm: import → esm.sh |
| `supabase/functions/storefront-api/index.ts` | Fix EPC payload structuur (12 regels) + debug log |

### Geen database wijzigingen nodig
De tenant data staat correct in de database.

