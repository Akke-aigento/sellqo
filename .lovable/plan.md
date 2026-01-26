
# Implementatieplan: Soft Integration voor Externe Fulfillment Software

## Probleemstelling

Fulfillment bedrijven en fabrikanten (90%+) werken met hun eigen WMS/ERP systemen en willen:
- **Niet** nog een software interface erbij
- Orders in hun eigen systeem blijven verwerken
- Alleen tracking data terugsturen

De uitdaging: hoe zorgen we ervoor dat **alles voor de eindklant** toch vanuit Sellqo komt (branding, notificaties, track & trace opvolging)?

## Huidige Situatie

| Component | Status | Werking |
|-----------|--------|---------|
| Fulfillment API | ✅ Aanwezig | `POST /orders/:id/shipped` met tracking |
| Klant notificaties | ✅ Aanwezig | Via `send-customer-message` |
| Marketplace sync | ✅ Aanwezig | Bol.com terugkoppeling werkt |
| Internationale carriers | ✅ Aanwezig | 14+ carriers incl. China |
| Inbound webhooks | ⚠️ Beperkt | Alleen Sendcloud/MyParcel |
| CSV tracking import | ❌ Ontbreekt | Geen bulk update mogelijkheid |
| Order Reference ID | ⚠️ Beperkt | Externe systemen kennen Sellqo order ID niet |
| Status polling | ❌ Ontbreekt | Geen automatische 17TRACK polling |

## Oplossing: Multi-Channel Tracking Ingest

We implementeren **meerdere manieren** waarop externe software tracking kan aanleveren:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     EXTERNE FULFILLMENT SOFTWARE                            │
│                   (WMS, ERP, CJ Dropshipping, etc.)                        │
└─────────────────────────────────────────────────────────────────────────────┘
          │                    │                    │                    │
          │ REST API           │ Webhook            │ CSV Upload         │ Email Parse
          │ (bestaand)         │ (nieuw)            │ (nieuw)            │ (optioneel)
          ▼                    ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SELLQO TRACKING INGEST                              │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Fulfillment │  │  Generic    │  │   CSV       │  │   Email     │        │
│  │    API      │  │  Webhook    │  │   Import    │  │   Parser    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                         │
│                                   ▼                                         │
│                        ┌─────────────────────┐                              │
│                        │  Tracking Processor │                              │
│                        │  - Normaliseer data │                              │
│                        │  - Match order      │                              │
│                        │  - Update database  │                              │
│                        └─────────┬───────────┘                              │
│                                  │                                          │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Klant Notificatie│      │ Marketplace Sync │      │ Order Update    │
│ (Sellqo branding)│      │ (Bol/Amazon/etc) │      │ (status/tracking)│
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## Deel 1: Order Reference System

### Probleem
Externe software kent de Sellqo `order_id` (UUID) niet. Ze kennen alleen hun eigen referentie of het ordernummer.

### Oplossing
Uitbreiding van de matching logica om orders te vinden op:
1. `order_id` (UUID) - voor API integraties
2. `order_number` (#0001) - Sellqo ordernummer
3. `marketplace_order_id` - Bol.com/Amazon ordernummer
4. `external_reference` - **nieuw veld** voor externe systeem referentie

**Database wijziging:**
```sql
ALTER TABLE orders ADD COLUMN external_reference TEXT;
CREATE INDEX idx_orders_external_reference ON orders(tenant_id, external_reference);
```

Dit `external_reference` veld wordt gevuld bij:
- Handmatige invoer door merchant
- Marketplace sync (kan overgenomen worden)
- Via API wanneer order wordt opgehaald

---

## Deel 2: Generic Tracking Webhook

### Doel
Een simpele webhook waar **elke** externe software naartoe kan posten, zonder specifieke API kennis.

### Endpoint
`POST /functions/v1/tracking-webhook`

### Payload (flexibel)
```json
{
  "api_key": "fk_live_xxx...",
  "order_reference": "#0001 | externe_ref | bol_order_id",
  "carrier": "china_post | China Post | chinapost",
  "tracking_number": "LP123456789CN",
  "tracking_url": "https://...",  // optioneel
  "status": "shipped | in_transit | delivered",  // optioneel
  "shipped_at": "2025-01-26T12:00:00Z"  // optioneel
}
```

### Features
- **Fuzzy carrier matching**: "china post", "CHINA-POST", "chinapost" → `china_post`
- **Multi-field order lookup**: Probeert meerdere velden om order te matchen
- **Idempotent**: Dubbele updates worden genegeerd
- **Automatische notifications**: Triggert klant email indien configured

---

## Deel 3: CSV Tracking Import

### Doel
Voor fulfillment partners die geen API kunnen/willen gebruiken, maar wel bulk exports kunnen maken.

### UI Locatie
Fulfillment Dashboard → "Import Tracking" knop

### Verwacht CSV formaat
```csv
order_reference,carrier,tracking_number,tracking_url,shipped_at
#0001,PostNL,3SMYPA123456,https://...,2025-01-26
#0002,China Post,LP123456789CN,,2025-01-26
```

### Alternatieve kolom namen (auto-detect)
| Kolom | Alternatieven |
|-------|---------------|
| order_reference | order_number, order_id, bestelnummer, reference |
| carrier | courier, verzender, shipping_carrier |
| tracking_number | track_trace, trackingnummer, barcode |
| shipped_at | ship_date, verzenddatum |

### Preview & Validatie
- Toont welke orders gematcht zijn
- Waarschuwt voor ontbrekende orders
- Toont welke carriers herkend worden
- "Dry run" optie om te testen zonder wijzigingen

---

## Deel 4: Email-to-Tracking (Optioneel/Premium)

### Doel
Fabrikanten in China versturen vaak tracking via email. Deze automatisch parsen.

### Werking
1. Dedicated email adres per tenant: `tracking-abc123@inbound.sellqo.app`
2. Edge function ontvangt email via Resend inbound
3. Parser haalt tracking info uit email body
4. Matcher zoekt order op basis van orderreferentie in email

### Bekende formaten
- AliExpress supplier emails
- CJ Dropshipping notificaties
- Alibaba order confirmations

Dit is **optioneel** en kan later toegevoegd worden als premium feature.

---

## Deel 5: 17TRACK Status Polling (Premium)

### Doel
Automatische status updates voor internationale zendingen zonder carrier webhook.

### Werking
```text
Cron Job (elke 4 uur)
        │
        ▼
┌───────────────────────────────────────┐
│  Select orders WHERE:                 │
│  - status = 'shipped'                 │
│  - carrier IN (international_carriers)│
│  - last_status_check < 4 hours ago    │
│  - shipped_at < 60 days               │
└───────────────────┬───────────────────┘
                    │
                    ▼
           ┌───────────────┐
           │  17TRACK API  │
           │  (batch query)│
           └───────┬───────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Parse status:       │
        │  - In transit        │
        │  - Customs           │
        │  - Out for delivery  │
        │  - Delivered         │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Update order status │
        │  Send notification   │
        │  (if delivered)      │
        └──────────────────────┘
```

### 17TRACK API
- **Free tier**: 100 queries/dag
- **Paid tier**: 1000+ queries/dag
- Per tenant configureerbaar (eigen API key)

---

## Deel 6: Klant Notificatie Flow

### Doel
Ongeacht welk kanaal tracking binnenkomt, klant krijgt altijd netjes geformatteerde email vanuit Sellqo branding.

### Template types
| Status | Email | Inhoud |
|--------|-------|--------|
| shipped | ✅ | "Je pakket is onderweg" + tracking link |
| in_transit | ❌ | Geen email (te veel spam) |
| out_for_delivery | ⚙️ | Optioneel: "Pakket komt vandaag" |
| delivered | ✅ | "Je pakket is bezorgd" + review vraag |
| exception | ✅ | "Er is een probleem met je zending" |

### Settings per tenant
- `notify_on_shipped`: true/false (default: true)
- `notify_on_delivered`: true/false (default: false)
- `notify_on_exception`: true/false (default: true)

---

## Technische Implementatie

| Bestand | Type | Beschrijving |
|---------|------|--------------|
| **Database** | | |
| Migratie | SQL | `external_reference` kolom op orders |
| Migratie | SQL | `tenant_tracking_settings` tabel |
| Migratie | SQL | Index voor order reference lookup |
| **Edge Functions** | | |
| `tracking-webhook/index.ts` | Nieuw | Generic webhook endpoint |
| `import-tracking-csv/index.ts` | Nieuw | CSV processing |
| `poll-17track/index.ts` | Nieuw | Status polling cron |
| **Frontend** | | |
| `TrackingImportButton.tsx` | Nieuw | CSV upload trigger op Fulfillment page |
| `TrackingImportDialog.tsx` | Nieuw | Import wizard dialog |
| `TrackingNotificationSettings.tsx` | Nieuw | Settings voor notificatie preferences |
| **Shared** | | |
| `trackingProcessor.ts` | Nieuw | Gedeelde logica voor order matching + carrier normalisatie |

---

## Use Cases na Implementatie

### Case 1: CJ Dropshipping
```text
Merchant → Bestelling via webshop → Sellqo
Sellqo → API sync → CJ Dropshipping (orders ophalen)
CJ → Verzenden vanuit China
CJ → POST tracking-webhook → Sellqo
Sellqo → Email naar klant: "Je pakket is onderweg"
```

### Case 2: Lokaal Magazijn met WMS
```text
Merchant → Bestelling → Sellqo
Magazijn → Print pakbon via Sellqo
Magazijn → Verwerk in eigen WMS
WMS → Export CSV met tracking
Merchant → Upload CSV in Sellqo
Sellqo → Bulk update + emails naar klanten
```

### Case 3: Fabrikant zonder API
```text
Merchant → Bestelling → Sellqo
Fabrikant → Produceert & verzendt
Fabrikant → Stuurt email met tracking naar merchant
Merchant → Copy/paste in Sellqo order detail
  OF
Merchant → Forward email naar tracking@inbound.sellqo.app
Sellqo → Parse + update + notificatie
```

### Case 4: AliExpress Dropshipping
```text
Merchant → Bestelling via Sellqo
Merchant → Handmatig bestellen bij AliExpress supplier
Supplier → Verzendt pakket
Sellqo → Poll 17TRACK elke 4 uur
17TRACK → Status: "Delivered"
Sellqo → Email naar klant: "Je pakket is bezorgd"
```

---

## Resultaat

Na implementatie kunnen fulfillment partners tracking aanleveren via:

| Methode | Technisch niveau | Use case |
|---------|-----------------|----------|
| **REST API** (bestaand) | Hoog | Moderne WMS met API capaciteit |
| **Generic Webhook** | Middel | Eenvoudige systemen met HTTP support |
| **CSV Upload** | Laag | Excel/spreadsheet workflows |
| **Email Forward** | Geen | Suppliers die alleen emailen |
| **17TRACK Polling** | Automatisch | Internationale zendingen zonder webhook |

**Alle communicatie naar de eindklant komt vanuit Sellqo** met de branding van de webshop, ongeacht welk kanaal de tracking data levert.
