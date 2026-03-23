

## Shipping email opfleuren — Coolblue-style

### Huidige situatie
De "bestelling is verzonden" email bevat alleen een kale tabel met carrier/tracknummer en een blauwe knop. De body_html wordt gegenereerd op **2 plekken**:
1. `src/hooks/useOrderShipping.ts` (regel 67-93) — frontend trigger
2. `supabase/functions/fulfillment-api/index.ts` (regel 291-295) — API trigger (nog kaler)

Beide sturen de body_html naar `send-customer-message`, die het wrapt in de standaard email template (header met logo, footer met adres).

### Wat we bouwen
Een veel leukere, Coolblue-achtige shipping email body met:
- Blije header tekst met emoji ("Joepie! Je pakket is onderweg! 🎉")
- Visueel aantrekkelijke tracking card met carrier icoon, tracknummer, en grote CTA-knop
- Stappen-indicator (Besteld → Verzonden → Onderweg → Bezorgd) — stap 2 actief
- Persoonlijke, informele tone-of-voice
- Subtiele tip/bemoediging onderaan ("Even geduld nog, binnenkort bij jou!")

### Aanpak — Shared helper functie

**Nieuw bestand:** `src/lib/shippingEmailTemplate.ts`
Een functie `generateShippingEmailHtml(params)` die de volledige body_html returnt. Parameters: orderNumber, carrierName, trackingNumber, trackingUrl, primaryColor (van tenant).

**`src/hooks/useOrderShipping.ts`** — importeer en gebruik de helper i.p.v. inline HTML

**`supabase/functions/fulfillment-api/index.ts`** — zelfde template inline (edge functions kunnen niet importeren uit src/), maar met dezelfde design

### Email design (binnen de bestaande wrapper)

```text
┌─────────────────────────────────────────┐
│  🎉 Joepie! Je pakket is onderweg!      │
│  Bestelling #1128 is verzonden          │
├─────────────────────────────────────────┤
│                                         │
│  ● Besteld  ● Verzonden  ○ Onderweg  ○ Bezorgd │
│  ━━━━━━━━━━━━●━━━━━━━━━━○━━━━━━━━━━━   │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  🚚 Bpost                         │  │
│  │  Tracknummer: CD117081258BE       │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │     📦 Volg je pakket →           │  │
│  │     (grote kleurrijke CTA)        │  │
│  └───────────────────────────────────┘  │
│                                         │
│  💡 Tip: Houd je brievenbus in de       │
│  gaten, het komt eraan!                 │
│                                         │
│  📦 Betreft bestelling: #1128          │
└─────────────────────────────────────────┘
```

### Bestanden
- `src/lib/shippingEmailTemplate.ts` — nieuw: shared template generator
- `src/hooks/useOrderShipping.ts` — gebruik de helper
- `supabase/functions/fulfillment-api/index.ts` — zelfde template inline

