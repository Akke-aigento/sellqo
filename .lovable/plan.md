

## Probleem: Geen Track & Trace link bij recente bestellingen

### Oorzaak

De laatste 4 bestellingen (#1123-#1126) zijn via de Bol.com sync binnengekomen. De Bol.com functies slaan de carrier op als `BPOST_BE` (Bol.com formaat) in plaats van `bpost`. Hierdoor:

1. `tracking_url` wordt **niet ingevuld** (3 van de 4 orders) of krijgt een generieke URL (`jfrfracking.info`)
2. De `TrackingInfoCard` toont de "Track & Trace" knop alleen als `order.tracking_url` een waarde heeft
3. `getCarrierById('BPOST_BE')` vindt geen match in `carrierPatterns.ts` (die kent alleen `bpost`)

**Bewijs uit de database:**

| Order | Carrier | tracking_url | Link zichtbaar? |
|-------|---------|-------------|----------------|
| #1122 en ouder | `bpost` | `https://track.bpost.cloud/...` | ✅ Ja |
| #1123-#1125 | `BPOST_BE` | NULL | ❌ Nee |
| #1126 | `BPOST_BE` | `https://jfrfracking.info/...` | ⚠️ Verkeerde URL |

### Oplossing: Twee wijzigingen

**1. `TrackingInfoCard.tsx` — Carrier normalisatie + URL fallback**

Bij het laden van de component: normaliseer de carrier (`BPOST_BE` → `bpost`) en genereer automatisch een tracking URL als die ontbreekt.

```typescript
// Normaliseer carrier bij initialisatie
function normalizeCarrierId(raw: string): string {
  const norm = raw.toLowerCase().replace(/[_-]/g, '');
  if (norm.includes('bpost')) return 'bpost';
  if (norm.includes('postnl') || norm === 'tnt') return 'postnl';
  if (norm.includes('dhl')) return 'dhl';
  // etc.
  return raw;
}

// In component: gebruik genormaliseerde carrier
const normalizedCarrier = normalizeCarrierId(order.carrier || '');

// Genereer tracking URL als die ontbreekt
const effectiveTrackingUrl = order.tracking_url || 
  generateTrackingUrl(normalizedCarrier, order.tracking_number, postalCode);
```

**2. Database migratie — Fix bestaande orders**

Eenmalige migratie om de 4 kapotte orders te repareren: carrier normaliseren naar `bpost` en correcte tracking URLs invullen.

```sql
UPDATE orders
SET 
  carrier = 'bpost',
  tracking_url = 'https://track.bpost.cloud/btr/web/#/search?itemCode=' || tracking_number
WHERE carrier = 'BPOST_BE' 
  AND tracking_number IS NOT NULL;
```

### Samenvatting

| Wijziging | Doel |
|-----------|------|
| `TrackingInfoCard.tsx`: carrier normalisatie + URL fallback | Toekomstige orders altijd correct tonen |
| SQL migratie: fix bestaande `BPOST_BE` orders | Bestaande orders repareren |

Na deze fix hebben alle orders een werkende Track & Trace link naar de bpost tracking pagina.

