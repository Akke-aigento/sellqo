

## Plan: POS respecteert BTW-inclusief/exclusief instelling

### Probleem
De tenant-instelling `default_vat_handling` kan `inclusive` of `exclusive` zijn. Bij `inclusive` zijn de productprijzen **inclusief BTW** — de POS moet dan de BTW *extraheren* uit de prijs in plaats van er bovenop te tellen. Momenteel telt de POS altijd BTW bovenop, waardoor klanten te veel betalen.

### Oplossing

#### 1. `usePOSCart` — VAT handling mode toevoegen

Het hook krijgt een nieuwe optie `vatHandling: 'inclusive' | 'exclusive'` (default `'exclusive'`).

**Bij `exclusive`** (huidige gedrag): `total = subtotaal - korting + BTW`

**Bij `inclusive`** (nieuw):
- Prijzen bevatten al BTW → geen BTW bovenop
- BTW wordt *geëxtraheerd* voor de breakdown: `btw = bedrag - (bedrag / (1 + rate/100))`
- `total = subtotaal - korting` (geen BTW erbij)
- De `taxBreakdown` toont nog steeds de geëxtraheerde BTW-bedragen (voor de bon/factuur)

#### 2. `POSTerminal.tsx` — tenant setting doorgeven

Lees `currentTenant.default_vat_handling` en geef het mee aan `usePOSCart({ defaultTaxRate, vatHandling })`.

#### 3. `POSCartPanel.tsx` — labels aanpassen

Bij inclusive: toon "BTW (incl.)" i.p.v. alleen "BTW 21%", zodat de medewerker snapt dat BTW al in de prijs zit en niet extra wordt berekend.

### Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/usePOSCart.ts` | Nieuwe `vatHandling` optie; bij `inclusive`: extraheer BTW i.p.v. optellen |
| `src/pages/admin/POSTerminal.tsx` | Geef `currentTenant.default_vat_handling` door aan `usePOSCart` |
| `src/components/admin/pos/POSCartPanel.tsx` | Label "(incl.)" bij inclusive modus |
| `src/components/admin/pos/POSMobileCartDrawer.tsx` | Zelfde label-aanpassing voor mobiel |

