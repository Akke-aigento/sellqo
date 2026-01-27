
# Plan: Klantvragen Forwarding via Resend Inbound Email

## Samenvatting

Dit plan implementeert een systeem waarmee klantvragen van Bol.com (en andere kanalen) automatisch worden doorgestuurd naar de SellQo inbox. Hierdoor hoeven merchants niet meer in te loggen op Bol.com om klanten te beantwoorden - alles gaat via één centraal punt.

---

## Huidige Situatie Analyse

### Wat al werkt

| Component | Status | Beschrijving |
|-----------|--------|--------------|
| `customer_messages` tabel | ✅ | Ondersteunt `direction: 'inbound'` en `channel: 'email'` |
| `useInbox` hook | ✅ | Groepeert berichten in conversaties, toont unread/unanswered |
| WhatsApp inbound | ✅ | `whatsapp-webhook` werkt perfect als voorbeeld |
| Resend outbound | ✅ | E-mails worden verzonden via `send-customer-message` |
| Notificaties | ✅ | Realtime toast bij nieuwe inbound berichten |

### Wat nog ontbreekt

| Component | Status | Nodig voor |
|-----------|--------|------------|
| Resend Inbound Webhook | ❌ | Ontvangen van doorgestuurde e-mails |
| Tenant-specifiek email adres | ❌ | Routing naar juiste merchant |
| Bol.com koppeling instructies | ❌ | Gebruikers vertellen hoe ze forwarden |
| Reply-to-inbox flow | ⚠️ | Antwoorden die teruggaan via Bol.com |

---

## Hoe Bol.com Klantvragen Werken

Bol.com heeft **geen API voor klantvragen**. In plaats daarvan werkt het als volgt:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  BOL.COM KLANTVRAGEN FLOW                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. KLANT STELT VRAAG                                                       │
│     └── Via Bol.com "Contact met verkoper" knop                            │
│                                                                             │
│  2. BOL.COM STUURT EMAIL                                                    │
│     ├── NAAR: Het "Klantenservice e-mailadres" in je Bol.com account       │
│     ├── VAN: klant@klantbericht.bol.com (geanonimiseerd)                   │
│     ├── SUBJECT: "Vraag over bestelling XXXXXXXXXX"                        │
│     └── BODY: De vraag + link naar Bol.com dashboard                       │
│                                                                             │
│  3. JE ANTWOORDT                                                            │
│     └── Reply op de email → Bol.com forward naar klant                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Oplossing:** We laten merchants hun "Klantenservice e-mailadres" in Bol.com instellen op hun unieke SellQo forwarding adres. Dan ontvangen wij de emails via Resend Inbound.

---

## Architectuur Overzicht

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  NIEUWE ARCHITECTUUR                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  KANALEN                          SELLQO                      DATABASE      │
│  ────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────┐                                                            │
│  │ Bol.com     │────┐                                                       │
│  │ Klantvraag  │    │         ┌────────────────────┐                       │
│  └─────────────┘    │         │                    │                       │
│                     │         │  handle-inbound-   │   ┌─────────────────┐ │
│  ┌─────────────┐    ├────────▶│  email             │──▶│ customer_       │ │
│  │ Webshop     │────┤   via   │  Edge Function     │   │ messages        │ │
│  │ Contact     │    │  Resend │                    │   │                 │ │
│  └─────────────┘    │         └────────────────────┘   │ direction:      │ │
│                     │                 │                 │ 'inbound'       │ │
│  ┌─────────────┐    │                 │                 │                 │ │
│  │ Amazon/     │────┘                 ▼                 └─────────────────┘ │
│  │ Andere      │              ┌────────────────────┐                       │
│  └─────────────┘              │  Tenant Matching   │                       │
│                               │  via unique email  │                       │
│                               │  prefix            │                       │
│                               └────────────────────┘                       │
│                                       │                                     │
│                                       ▼                                     │
│                               ┌────────────────────┐                       │
│                               │  notifications     │                       │
│                               │  + realtime toast  │                       │
│                               └────────────────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technische Implementatie

### Stap 1: Database Uitbreiding

Nieuwe kolommen in `tenants` tabel:

```sql
-- Uniek inbound email prefix per tenant
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS 
  inbound_email_prefix TEXT UNIQUE;

-- Automatisch genereren bij nieuwe tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS 
  inbound_email_enabled BOOLEAN DEFAULT false;
```

De prefix wordt automatisch gegenereerd op basis van de tenant slug, bijvoorbeeld:
- Tenant slug: `mijn-winkel`
- Inbound adres: `mijn-winkel@inbound.sellqo.app`

### Stap 2: Resend Domain Configuratie

Voor inbound emails met Resend moet er een domein worden geconfigureerd:

1. **Inbound Domain**: `inbound.sellqo.app` (of subdomain)
2. **MX Records**: Resend MX records toevoegen aan DNS
3. **Webhook URL**: `https://[project-id].supabase.co/functions/v1/handle-inbound-email`

**Configuratie stappen (door jou uit te voeren):**
1. Ga naar Resend Dashboard → Domains
2. Voeg `inbound.sellqo.app` toe als inbound domain
3. Configureer de MX records bij je DNS provider
4. Stel de webhook URL in

### Stap 3: Edge Function `handle-inbound-email`

```typescript
// supabase/functions/handle-inbound-email/index.ts

// Resend stuurt inbound emails als JSON payload:
interface ResendInboundPayload {
  from: string;           // afzender email
  to: string[];           // ontvangers (onze tenant prefix@inbound.sellqo.app)
  subject: string;
  text: string;           // plain text body
  html: string;           // HTML body
  headers: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: string;      // base64
    content_type: string;
  }>;
}

// Verwerking:
// 1. Parse "to" address om tenant prefix te vinden
// 2. Lookup tenant by inbound_email_prefix
// 3. Optioneel: match Bol.com order ID uit subject
// 4. Optioneel: match klant op basis van email/order
// 5. Sla bericht op in customer_messages met direction='inbound'
// 6. Maak notificatie aan
```

### Stap 4: Tenant Routing Logica

```text
INBOUND EMAIL: klantvraag@inbound.sellqo.app → tenant "mijn-winkel"

Lookup flow:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  1. Parse TO address: "mijn-winkel@inbound.sellqo.app"                     │
│                        ^^^^^^^^^^^^                                         │
│                        prefix                                               │
│                                                                             │
│  2. SELECT * FROM tenants WHERE inbound_email_prefix = 'mijn-winkel'       │
│                                                                             │
│  3. Bol.com context detection (uit subject):                               │
│     "Vraag over bestelling 1234567890" → parse order ID                    │
│                                                                             │
│  4. Order lookup (optioneel):                                               │
│     SELECT * FROM orders WHERE marketplace_order_id = '1234567890'         │
│     └── Hiermee linken we automatisch aan de juiste bestelling!            │
│                                                                             │
│  5. Customer matching (optioneel):                                          │
│     - Via order.customer_id                                                 │
│     - Via FROM email in customers tabel                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Stap 5: UI voor Configuratie

Nieuwe sectie in "Koppelingen & Kanalen" → "Email Inbox":

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  📥 Inkomende E-mails                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Ontvang klantvragen direct in SellQo door je klantenservice e-mails       │
│  door te sturen naar je unieke SellQo adres.                               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Je unieke forwarding adres:                                        │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  mijn-winkel@inbound.sellqo.app                       [Kopieer]│ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  📝 Zo koppel je Bol.com:                                                  │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Ga naar Bol.com → Instellingen → Winkelsettings                        │
│  2. Zoek "Klantenservice e-mailadres"                                      │
│  3. Vul in: mijn-winkel@inbound.sellqo.app                                 │
│  4. Sla op - klaar!                                                        │
│                                                                             │
│  ✅ Alle klantvragen komen nu automatisch in je SellQo inbox.              │
│                                                                             │
│  ──────────────────────────────────────────────────────────────────────    │
│                                                                             │
│  📊 Status                                                                  │
│  ─────────────────────────────────────────────────────────────────────     │
│  🟢 Inbox actief - 23 berichten ontvangen deze week                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Stapsgewijs Configuratie Plan

Omdat je vroeg om een stapsgewijze handleiding voor de Resend inbound configuratie:

### Fase 1: Resend Inbound Domain Setup (Handmatig, door jou)

1. **Log in op Resend Dashboard** (https://resend.com/domains)
2. **Voeg inbound domain toe**:
   - Klik "Add Domain" → selecteer "Inbound"
   - Domein: `inbound.sellqo.app` (of een ander subdomein)
3. **Configureer DNS** (bij je domein provider):
   ```text
   MX   inbound.sellqo.app   10 feedback-smtp.us-east-1.amazonses.com
   ```
   (Exacte records worden getoond in Resend na toevoegen)
4. **Configureer Webhook**:
   - Webhook URL: `https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/handle-inbound-email`
   - Events: `inbound.email.received`

### Fase 2: Database Migratie

```sql
-- Voeg inbound email velden toe aan tenants
ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS inbound_email_prefix TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS inbound_email_enabled BOOLEAN DEFAULT false;

-- Automatisch prefix genereren voor bestaande tenants
UPDATE tenants 
SET inbound_email_prefix = slug 
WHERE inbound_email_prefix IS NULL;

-- Trigger voor nieuwe tenants
CREATE OR REPLACE FUNCTION set_default_inbound_prefix()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.inbound_email_prefix IS NULL THEN
    NEW.inbound_email_prefix := NEW.slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Fase 3: Edge Function Development

Nieuwe functie: `handle-inbound-email`
- Ontvangt Resend webhook payload
- Parsed TO address voor tenant matching
- Detecteert Bol.com order context uit subject
- Matcht klant en bestelling indien mogelijk
- Slaat bericht op als `direction: 'inbound'`
- Creëert notificatie

### Fase 4: UI Component

Nieuwe settings sectie: "Inkomende E-mails"
- Toont unieke forwarding adres
- Kopieer knop
- Stapsgewijze instructies voor Bol.com
- Statistieken (ontvangen berichten)

---

## Antwoord Flow (Reply-to-Inbox)

Wanneer een merchant antwoordt vanuit de SellQo inbox:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  REPLY FLOW                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Merchant klikt "Beantwoorden" in SellQo inbox                          │
│                                                                             │
│  2. SellQo stuurt email via Resend:                                        │
│     FROM: "Mijn Winkel <noreply@mijnwinkel.nl>"                            │
│     TO: klant@klantbericht.bol.com (originele afzender)                    │
│     REPLY-TO: klant@klantbericht.bol.com                                   │
│     SUBJECT: Re: Vraag over bestelling 1234567890                          │
│                                                                             │
│  3. Bol.com ontvangt de reply en forward naar de klant                     │
│                                                                             │
│  4. Klant ziet antwoord in hun Bol.com account                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Dit werkt al grotendeels met de bestaande `send-customer-message` functie. We moeten alleen zorgen dat:
- De originele `from_email` wordt bewaard als `reply_to_email`
- De `ReplyComposer` deze waarde gebruikt

---

## Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| **Database** | | |
| `xxx_inbound_email.sql` | Nieuw | Migratie voor tenant inbound velden |
| **Edge Functions** | | |
| `supabase/functions/handle-inbound-email/index.ts` | Nieuw | Webhook handler voor Resend inbound |
| **Components** | | |
| `src/components/admin/settings/InboundEmailSettings.tsx` | Nieuw | Configuratie UI |
| **Hooks** | | |
| `src/hooks/useInboundEmail.ts` | Nieuw | Status & statistieken |

---

## Verificatie Checklist

Na implementatie kunnen we testen:

- [ ] Resend domain is geconfigureerd en verified
- [ ] MX records zijn correct ingesteld
- [ ] Webhook ontvangt test emails
- [ ] Tenant routing werkt correct
- [ ] Bol.com order ID wordt geparsed uit subject
- [ ] Berichten verschijnen in inbox
- [ ] Notificaties worden aangemaakt
- [ ] Reply flow werkt terug naar Bol.com

---

## Conclusie

Dit plan maakt het mogelijk om:
- ✅ Bol.com klantvragen automatisch te ontvangen in SellQo
- ✅ Niet meer in te loggen op Bol.com voor klantenservice
- ✅ Berichten te koppelen aan bestellingen en klanten
- ✅ Direct te antwoorden vanuit één centrale inbox
- ✅ Uitbreidbaar naar andere kanalen (Amazon, eigen webshop contactformulier)

De eerste stap is de Resend inbound domain configuratie - wil je dat we daar mee beginnen?
