
# ✅ Plan Voltooid: BTW-inclusief Factuurberekening Gecorrigeerd

## Wat Was Het Probleem

De tenant had `default_vat_handling: inclusive` ingesteld, maar de factuur-generator telde BTW er nog bovenop.

**Voorbeeld VOOR de fix:**
| Order | Ordertotaal | Factuur | Verschil |
|-------|-------------|---------|----------|
| #1022 | €27,95 | €33,82 | +21% te veel |

## De Oplossing (Geïmplementeerd)

### Edge Function `generate-invoice` Aangepast

De functie controleert nu `tenant.default_vat_handling`:

```typescript
if (vatHandling === 'inclusive') {
  // Prijzen zijn incl BTW - terugrekenen
  finalTotal = orderSubtotal + shippingCost;
  subtotalExcl = finalTotal / (1 + vatRate / 100);
  calculatedTaxAmount = finalTotal - subtotalExcl;
} else {
  // Prijzen zijn excl BTW - BTW erbij optellen
  subtotalExcl = orderSubtotal + shippingCost;
  calculatedTaxAmount = subtotalExcl * (vatRate / 100);
  finalTotal = subtotalExcl + calculatedTaxAmount;
}
```

### Resultaat NA de fix:
| Order | Ordertotaal | Factuur | Status |
|-------|-------------|---------|--------|
| #1022 | €27,95 | €27,95 | ✅ Correct |
| #1089 | €445,00 | €445,00 | ✅ Correct |
| #1024 | €50,31 | €50,31 | ✅ Correct |

De facturen tonen nu:
- Subtotaal (excl BTW): correct teruggerekend
- BTW 21%: correct berekend  
- Totaal: gelijk aan ordertotaal ✓

## Acties Uitgevoerd

1. ✅ `generate-invoice` edge function aangepast
2. ✅ Alle 52 foutieve facturen verwijderd
3. ✅ Nieuwe facturen worden automatisch correct gegenereerd
4. ✅ Cron job blijft draaien voor de rest

## Notities

- De `auto-invoice-cron` job draait elke 5 minuten en pakt alle betaalde orders
- Nieuwe orders krijgen automatisch correct berekende facturen
