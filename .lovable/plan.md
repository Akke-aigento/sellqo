

## Probleem: Track & Trace status wordt NIET automatisch bijgewerkt

### Bewijs uit de database

Alle 8 shipped orders hebben:
- `tracking_status`: **NULL** (nooit gepolled)
- `last_tracking_check`: **NULL** (nooit gecheckt)
- Carrier opgeslagen als `BPOST_BE` (uppercase) — maar de polling functie zoekt `bpost` (lowercase)

De `shipping_status_updates` tabel is **volledig leeg** — er is nog nooit een tracking update binnengekomen.

### Twee oorzaken

**1. Carrier mismatch (hoofdoorzaak)**

De Bol.com import slaat carriers op als `BPOST_BE`, maar de `detectCarrier()` functie in `poll-tracking-status` verwacht lowercase `bpost`. De `normalizeCarrier()` in de webhook kent `bpost` maar niet `BPOST_BE`. Het resultaat: carrier wordt niet herkend → polling wordt overgeslagen.

**2. De cron job draait mogelijk niet correct**

De cron job bestaat (`poll-tracking-status-every-30min`), maar er zijn **geen logs** en **geen resultaten**. De functie lijkt óf niet aangeroepen te worden, óf direct te falen zonder output.

### Oplossing

**1. Carrier normalisatie fixen in `poll-tracking-status/index.ts`**

De `detectCarrier()` functie moet carrier-aliassen normaliseren vóór matching:

```typescript
function detectCarrier(trackingNumber: string, existingCarrier?: string | null): string | null {
  const tn = (trackingNumber || "").trim().toUpperCase();
  
  // Pattern-based detection first
  if (/^3S/.test(tn)) return "postnl";
  if (/^JD\d{16,}$/.test(tn) || /^JVGL/.test(tn)) return "dhl";
  if (/^(CD|LX)/.test(tn)) return "bpost";  // ← dit matcht CD-nummers correct
  if (/^00340/.test(tn) || /^\d{14,15}$/.test(tn)) return "dpd";
  if (/^GLS/.test(tn) || /^\d{8,11}$/.test(tn)) return "gls";
  
  // Normalize existing carrier as fallback
  if (existingCarrier) {
    const norm = existingCarrier.toLowerCase().replace(/[_-]/g, '');
    if (norm.includes('bpost')) return 'bpost';
    if (norm.includes('postnl') || norm === 'tnt') return 'postnl';
    if (norm.includes('dhl')) return 'dhl';
    if (norm.includes('dpd')) return 'dpd';
    if (norm.includes('gls')) return 'gls';
    return existingCarrier.toLowerCase();
  }
  
  return null;
}
```

Dit lost het probleem op voor tracking nummers die al met `CD` beginnen (dat matched het `bpost` patroon). Maar voor nummers als `323211629159997110533030` (pure cijfers, 24 lang) die door Bol.com als `BPOST_BE` worden aangeleverd, is de fallback-normalisatie essentieel.

**2. Tracking nummers met pure cijfers: bpost 24-digit patroon toevoegen**

bpost barcode-nummers zijn 24+ cijfers. Toevoegen aan pattern detection:

```typescript
// bpost barcode: 24+ digits starting with 3232
if (/^3232\d{20,}$/.test(tn)) return "bpost";
```

**3. Edge function herdeploy triggeren**

De edge function moet opnieuw gedeployed worden met de carrier-fixes. Dit gebeurt automatisch bij code-wijziging.

### Samenvatting wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/poll-tracking-status/index.ts` | Carrier normalisatie uitbreiden: `BPOST_BE` → `bpost`, bpost 24-digit barcode patroon, betere fallback matching |

Na deze fix zullen alle bestaande shipped orders bij de volgende poll-cyclus (elke 30 min) automatisch hun tracking status ophalen en bijwerken naar `in_transit`, `delivered`, etc.

