

## Klant Activiteiten Tracking & Timeline

### Wat wordt er gebouwd

Een uitgebreid klant-trackingsysteem dat alle interacties van een klant vastlegt — emails geopend/geklikt, pagina's bekeken op de webshop, tijd op pagina, producten bekeken, winkelwagen-acties, bestellingen, etc. Tenants krijgen een 360° klantprofiel waarmee ze gerichte acties kunnen opzetten.

### Overzicht

```text
┌─────────────────────────────────────────────┐
│  STOREFRONT (klant browst de webshop)       │
│  → JS tracker stuurt events naar edge fn    │
│    - page_view, product_view, add_to_cart   │
│    - time_on_page, search, wishlist_add     │
└─────────┬───────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│  customer_events tabel                      │
│  (unified event log per klant per tenant)   │
│  + campaign_sends (email opens/clicks)      │
│  + orders (aankopen)                        │
│  + customer_messages (gesprekken)           │
└─────────┬───────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│  Klant Detail → "Activiteit" tab            │
│  360° timeline met alle interacties         │
│  + Engagement score + gedragsinzichten      │
└─────────────────────────────────────────────┘
```

### Stap 1: Database — `customer_events` tabel

Nieuwe tabel voor alle trackbare events:

| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid NOT NULL | FK tenants |
| customer_id | uuid NULL | FK customers (null voor anonieme bezoekers) |
| storefront_customer_id | uuid NULL | FK storefront_customers |
| session_id | text | Browser session identifier |
| event_type | text NOT NULL | page_view, product_view, add_to_cart, remove_from_cart, checkout_start, search, wishlist_add, email_open, email_click |
| event_data | jsonb | Vrije metadata (product_id, page_url, search_query, duration_seconds, link_url, campaign_id, etc.) |
| page_url | text NULL | Welke pagina |
| referrer_url | text NULL | Waar vandaan |
| user_agent | text NULL | Browser info |
| ip_hash | text NULL | Gehashte IP (privacy) |
| created_at | timestamptz | Event timestamp |

RLS: tenants zien alleen eigen events. Insert via edge function (service role).

### Stap 2: Edge function — `track-storefront-event`

Ontvangt events vanuit de storefront JS tracker:
- Valideert tenant_id, event_type
- Hasht IP voor privacy
- Koppelt aan storefront_customer_id als de klant ingelogd is
- Slaat op in `customer_events`
- Geen auth vereist (publiek endpoint, maar rate-limited)

### Stap 3: Storefront JS tracker

Lichtgewicht tracking snippet dat automatisch wordt geladen in de storefront:
- **Automatische events**: page_view (met time_on_page bij verlaten), product_view
- **Actie events**: add_to_cart, remove_from_cart, checkout_start, search
- Gebruikt `sessionStorage` voor een session_id
- Stuurt batched events (elke 5 sec of bij page unload)
- Respecteert cookie-consent (checkt `storefront_tracking_settings`)

Wordt als util/hook toegevoegd aan de storefront layout.

### Stap 4: Email events koppelen

De bestaande `process-email-webhook` edge function schrijft al naar `campaign_sends`. We voegen daar een extra INSERT naar `customer_events` toe zodat email_open en email_click ook in de unified timeline verschijnen.

### Stap 5: "Activiteit" tab op CustomerDetail pagina

Nieuwe tab naast Bestellingen, Gesprekken en Gegevens:

**Timeline view** — Chronologisch alle events:
- 🔵 Pagina bekeken: "/collectie/schoenen" — 2m 34s
- 🟢 Product bekeken: "Stitch Hoodie Blauw"
- 🛒 Toegevoegd aan winkelwagen: "Stitch Hoodie Blauw"
- 📧 Email geopend: "Welkom bij Mancini Milano"
- 🔗 Email link geklikt: "Bekijk collectie"
- 💰 Bestelling geplaatst: #1042 — €89,00

**Engagement samenvatting bovenaan:**
- Totaal sessies | Pagina's bekeken | Emails geopend | Gem. tijd op site
- Engagement score (berekend uit alle activiteit)

**Filters:** event type, datum range

### Stap 6: Engagement score berekening

Gewogen score op basis van:
- Page view: +1
- Product view: +2
- Add to cart: +5
- Email open: +3
- Email click: +5
- Purchase: +20
- Recency bonus (recente activiteit telt zwaarder)

Wordt client-side berekend uit de events data (geen aparte kolom nodig initieel).

### Bestanden

| Bestand | Actie |
|---|---|
| `customer_events` tabel | Nieuw — migration |
| `supabase/functions/track-storefront-event/index.ts` | Nieuw — event ontvangst endpoint |
| `src/hooks/useStorefrontTracking.ts` | Nieuw — JS tracker hook voor storefront |
| `src/hooks/useCustomerEvents.ts` | Nieuw — events ophalen + engagement berekening |
| `src/components/admin/customers/CustomerActivityTab.tsx` | Nieuw — timeline + engagement UI |
| `src/pages/admin/CustomerDetail.tsx` | Activiteit tab toevoegen |
| `supabase/functions/process-email-webhook/index.ts` | Email events ook naar customer_events schrijven |
| Storefront layout component | Tracking hook inladen |

### Geen externe API keys nodig

