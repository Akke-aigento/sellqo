

## Fix: Kapotte track & trace links in klantmails

### Probleem
De edge functions `create-bol-vvb-label` en `confirm-bol-shipment` gebruiken een hardcoded URL `https://jfrfracking.info/track/nl-NL/?B={tracking}` als tracking URL. Dit domein werkt niet.

Ondertussen bestaat er al een werkende `generateTrackingUrl()` functie in `src/lib/carrierPatterns.ts` die de juiste carrier-specifieke URLs genereert (bijv. bpost → `https://track.bpost.cloud/btr/web/#/search?itemCode=CD117081258BE`).

### Oplossing
Alle hardcoded `jfrfracking.info` URLs in de edge functions vervangen door de juiste carrier-specifieke tracking URLs. Aangezien edge functions geen toegang hebben tot `src/lib/`, kopieer ik de carrier pattern lookup direct in de edge functions (of in een `_shared` module).

### Aanpak

1. **Maak `supabase/functions/_shared/carrier-tracking.ts`** — Een gedeelde module met de carrier patterns en een `generateTrackingUrl()` functie, gebaseerd op de bestaande `carrierPatterns.ts`. Bevat in ieder geval bpost, PostNL, DHL, DPD, en alle andere carriers.

2. **Update `create-bol-vvb-label/index.ts`** — Vervang alle `https://jfrfracking.info/track/nl-NL/?B=${...}` door een aanroep naar de gedeelde `generateTrackingUrl()`, op basis van de gedetecteerde carrier.

3. **Update `confirm-bol-shipment/index.ts`** — Idem: gebruik de gedeelde functie in plaats van de hardcoded URL.

4. **Deploy beide edge functions** zodat de fix live gaat.

### Resultaat
Klanten krijgen werkende tracking links die direct naar de carrier-website wijzen (bpost, PostNL, DHL, etc.).

### Bestanden
- `supabase/functions/_shared/carrier-tracking.ts` — nieuw: gedeelde carrier URL generator
- `supabase/functions/create-bol-vvb-label/index.ts` — vervang hardcoded URLs
- `supabase/functions/confirm-bol-shipment/index.ts` — vervang hardcoded URLs

