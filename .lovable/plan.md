
# Plan: BTW-inclusief Factuurberekening Corrigeren

## Probleem Geïdentificeerd

Jouw tenant heeft `default_vat_handling: inclusive` ingesteld, wat betekent dat alle productprijzen al **inclusief BTW** zijn. De factuur-generator houdt hier geen rekening mee en telt 21% BTW er bovenop, waardoor alle facturen te hoog uitvallen.

**Voorbeeld van het probleem:**
| Order | Ordertotaal | Factuur (nu) | Correct zou zijn |
|-------|-------------|--------------|------------------|
| #1058 | €15,95 (incl) | €19,30 | €15,95 |
| #1062 | €27,95 (incl) | €33,82 | €27,95 |
| #1060 | €537,30 (incl) | €650,13 | €537,30 |

---

## Oplossing

### Stap 1: Edge Function Aanpassen

De `generate-invoice` functie wordt aangepast om te controleren of prijzen inclusief of exclusief BTW zijn.

**Huidige logica:**
```
subtotal = €27.95
tax = subtotal × 21% = €5.87
total = €33.82 (FOUT)
```

**Nieuwe logica voor inclusieve prijzen:**
```
totaal_incl = €27.95
subtotal_excl = €27.95 / 1.21 = €23.10
tax = €4.85
total = €27.95 (CORRECT)
```

De factuur toont dan netjes:
- Subtotaal (excl BTW): €23,10
- BTW 21%: €4,85
- **Totaal: €27,95** ✓

### Stap 2: Alle Bestaande Facturen Verwijderen en Opnieuw Genereren

Er zijn ~52 foutieve facturen die verwijderd en opnieuw gegenereerd moeten worden:
1. Verwijder alle bestaande facturen + gekoppelde invoice_lines
2. Verwijder de archief-records
3. Roep de generate-invoice functie opnieuw aan voor elke order

---

## Technische Details

### Wijzigingen in `generate-invoice/index.ts`

1. **Tenant vat_handling ophalen** - al beschikbaar via `tenant.default_vat_handling`

2. **BTW herberekening toevoegen:**
```typescript
const vatHandling = tenant.default_vat_handling || 'exclusive';
const taxPercent = tenant.tax_percentage || 21;

let subtotalExcl: number;
let calculatedTax: number;
let finalTotal: number;

if (vatHandling === 'inclusive') {
  // Prijzen zijn incl BTW - terugrekenen
  finalTotal = subtotal + shippingCost;
  subtotalExcl = finalTotal / (1 + taxPercent / 100);
  calculatedTax = finalTotal - subtotalExcl;
} else {
  // Prijzen zijn excl BTW - normale berekening
  subtotalExcl = subtotal + shippingCost;
  calculatedTax = subtotalExcl * (taxPercent / 100);
  finalTotal = subtotalExcl + calculatedTax;
}
```

3. **Unit prices op factuurregels ook corrigeren** - per regel de netto prijs berekenen

### Hergeneren van Facturen

Na de code-fix:
1. Bestaande facturen verwijderen via SQL
2. Opnieuw genereren via de cron-job of handmatig triggeren

---

## Wat Je Krijgt

Na implementatie:
- Facturen tonen correcte subtotaal (excl BTW)
- BTW-bedrag wordt correct berekend (teruggerekend uit totaal)
- Eindtotaal komt overeen met het ordertotaal
- PDF en UBL/XML facturen zijn fiscaal correct
