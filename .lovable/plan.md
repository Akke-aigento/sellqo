

# Plan: WhatsApp Business Integration

## Overzicht

Volledige WhatsApp Business integratie voor transactionele berichten, tracking updates, en klantcommunicatie. Dit bouwt voort op de bestaande Meta Commerce integratie (catalogus sync) en voegt messaging capabilities toe.

## Architectuur

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│  WhatsApp Business Platform                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐          │
│  │  Cloud API          │◄───│  Webhook Receiver   │───►│  Business Account   │          │
│  │  (Send Messages)    │    │  (Inbound Messages) │    │  (Templates)        │          │
│  └─────────────────────┘    └─────────────────────┘    └─────────────────────┘          │
│           │                          │                                                  │
│           ▼                          ▼                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │                           SellQo Edge Functions                                   │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                    │  │
│  │  │ send-whatsapp   │  │ whatsapp-webhook│  │ whatsapp-       │                    │  │
│  │  │ -message        │  │ -receiver       │  │ templates       │                    │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘                    │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│           │                          │                                                  │
│           ▼                          ▼                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              Database                                             │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                    │  │
│  │  │ whatsapp_       │  │ customer_       │  │ whatsapp_       │                    │  │
│  │  │ connections     │  │ messages        │  │ templates       │                    │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘                    │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Functies & Use Cases

### 1. Order Confirmatie via WhatsApp

```text
┌─────────────────────────────────────────┐
│  📱 WhatsApp                            │
│                                         │
│  ✅ Bestelling bevestigd!               │
│                                         │
│  Hallo Jan,                             │
│                                         │
│  Bedankt voor je bestelling #0042!      │
│                                         │
│  📦 2x Vintage Lamp - €49,95            │
│  📦 1x Design Stoel - €129,00           │
│  ─────────────────────────              │
│  Totaal: €178,95                        │
│                                         │
│  We gaan direct aan de slag met         │
│  je bestelling!                         │
│                                         │
│  [📦 Track bestelling]                  │
│                                         │
└─────────────────────────────────────────┘
```

### 2. Verzending & Track & Trace

```text
┌─────────────────────────────────────────┐
│  📱 WhatsApp                            │
│                                         │
│  📦 Je pakket is onderweg!              │
│                                         │
│  Bestelling #0042 is verzonden via      │
│  PostNL en wordt verwacht op:           │
│                                         │
│  📅 Dinsdag 28 januari                  │
│                                         │
│  🔗 Volg je pakket:                     │
│  postnl.nl/track/3S12345678901234       │
│                                         │
│  [📍 Track & Trace openen]              │
│                                         │
└─────────────────────────────────────────┘
```

### 3. Abandoned Cart Recovery

```text
┌─────────────────────────────────────────┐
│  📱 WhatsApp                            │
│                                         │
│  👋 Je winkelwagen wacht op je!         │
│                                         │
│  Hallo Marie,                           │
│                                         │
│  Je hebt nog 2 items in je              │
│  winkelwagen bij [Winkel]:              │
│                                         │
│  🛒 Vintage Lamp - €49,95               │
│  🛒 Design Kussen - €24,95              │
│                                         │
│  Rond je bestelling af en ontvang       │
│  10% korting met code: COMEBACK10       │
│                                         │
│  [🛒 Bestelling afronden]               │
│                                         │
└─────────────────────────────────────────┘
```

### 4. Klant Antwoorden → Inbox

```text
┌─────────────────────────────────────────┐
│  📱 WhatsApp (klant reageert)           │
│                                         │
│  "Hoi! Is die lamp ook in zwart         │
│   beschikbaar?"                         │
│                                         │
└─────────────────────────────────────────┘
           ↓ webhook
┌─────────────────────────────────────────┐
│  📬 SellQo Inbox                        │
│                                         │
│  Nieuw bericht via WhatsApp             │
│  Van: Marie (+31612345678)              │
│  Re: Bestelling #0042                   │
│                                         │
│  "Hoi! Is die lamp ook in zwart         │
│   beschikbaar?"                         │
│                                         │
│  [💬 Beantwoorden]                      │
│                                         │
└─────────────────────────────────────────┘
```

## Database Schema

### Nieuwe Tabellen

```sql
-- WhatsApp Business Account connecties per tenant
CREATE TABLE public.whatsapp_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  business_account_id TEXT NOT NULL,
  display_phone_number TEXT NOT NULL,
  verified_name TEXT,
  access_token_encrypted TEXT NOT NULL,
  webhook_verify_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  is_active BOOLEAN NOT NULL DEFAULT true,
  quality_rating TEXT, -- GREEN, YELLOW, RED
  messaging_limit TEXT, -- TIER_1K, TIER_10K, etc.
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Message templates (goedgekeurd door Meta)
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN (
    'order_confirmation', 'shipping_update', 'delivery_confirmation',
    'abandoned_cart', 'payment_reminder', 'review_request', 'custom'
  )),
  language TEXT NOT NULL DEFAULT 'nl',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  meta_template_id TEXT,
  header_text TEXT,
  body_text TEXT NOT NULL,
  footer_text TEXT,
  buttons JSONB DEFAULT '[]',
  variables JSONB DEFAULT '[]', -- {{1}}, {{2}}, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WhatsApp preferences per klant
ALTER TABLE public.customers 
  ADD COLUMN whatsapp_number TEXT,
  ADD COLUMN whatsapp_opted_in BOOLEAN DEFAULT false,
  ADD COLUMN whatsapp_opted_in_at TIMESTAMPTZ;

-- Extend customer_messages voor WhatsApp
ALTER TABLE public.customer_messages
  ADD COLUMN channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'whatsapp', 'sms')),
  ADD COLUMN whatsapp_message_id TEXT,
  ADD COLUMN whatsapp_status TEXT CHECK (whatsapp_status IN ('sent', 'delivered', 'read', 'failed'));
```

### Tenant Settings

```sql
-- Uitbreiding tenant notification settings
ALTER TABLE public.tenants
  ADD COLUMN whatsapp_enabled BOOLEAN DEFAULT false,
  ADD COLUMN whatsapp_order_confirmation BOOLEAN DEFAULT true,
  ADD COLUMN whatsapp_shipping_updates BOOLEAN DEFAULT true,
  ADD COLUMN whatsapp_abandoned_cart BOOLEAN DEFAULT false,
  ADD COLUMN whatsapp_abandoned_cart_delay_hours INTEGER DEFAULT 1;
```

## Edge Functions

### 1. send-whatsapp-message

```typescript
// supabase/functions/send-whatsapp-message/index.ts

interface SendWhatsAppRequest {
  tenant_id: string;
  customer_id: string;
  template_type: string;
  template_variables: Record<string, string>;
  order_id?: string;
}

// Stuurt berichten via Meta Cloud API
// Ondersteunt template messages (goedgekeurd door Meta)
// Logt naar customer_messages met channel='whatsapp'
```

### 2. whatsapp-webhook-receiver

```typescript
// supabase/functions/whatsapp-webhook-receiver/index.ts

// Ontvangt inkomende berichten van klanten
// Verificatie via webhook_verify_token
// Slaat berichten op in customer_messages met direction='inbound'
// Triggert realtime notificatie naar dashboard
```

### 3. whatsapp-status-webhook

```typescript
// supabase/functions/whatsapp-status-webhook/index.ts

// Ontvangt delivery/read receipts
// Update whatsapp_status in customer_messages
// sent → delivered → read
```

## UI Componenten

### WhatsApp Settings Page

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  📱 WhatsApp Business                                                       │
│  Stuur automatische berichten naar klanten via WhatsApp                    │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  Verbinding                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ✅ Verbonden                                                       │   │
│  │                                                                      │   │
│  │  📞 +31 6 12345678                                                   │   │
│  │  🏢 Mijn Webshop B.V.                                                │   │
│  │  🟢 Kwaliteit: Goed                                                  │   │
│  │                                                                      │   │
│  │  [🔄 Vernieuwen] [❌ Ontkoppelen]                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  Automatische Berichten                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ☑️ Bestelbevestiging                                               │   │
│  │     Stuur bevestiging na succesvolle betaling                       │   │
│  │                                                                      │   │
│  │  ☑️ Verzending updates                                               │   │
│  │     Stuur track & trace wanneer bestelling is verzonden             │   │
│  │                                                                      │   │
│  │  ☑️ Aflevering bevestiging                                          │   │
│  │     Stuur bericht wanneer pakket is afgeleverd                      │   │
│  │                                                                      │   │
│  │  ☐ Verlaten winkelwagen                            [⚙️ Instellingen]│   │
│  │     Herinner klanten aan achtergelaten items                        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  Message Templates                                                          │
│  ┌─────────────────┬───────────────┬─────────────┬─────────────────────┐   │
│  │ Template        │ Type          │ Status      │ Acties              │   │
│  ├─────────────────┼───────────────┼─────────────┼─────────────────────┤   │
│  │ order_confirm   │ Bevestiging   │ ✅ Approved │ [👁️] [✏️]           │   │
│  │ shipping_update │ Verzending    │ ✅ Approved │ [👁️] [✏️]           │   │
│  │ cart_reminder   │ Winkelwagen   │ ⏳ Pending  │ [👁️] [✏️]           │   │
│  └─────────────────┴───────────────┴─────────────┴─────────────────────┘   │
│                                                                             │
│  [➕ Nieuwe template]                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### WhatsApp Conversation in Inbox

Uitbreiding van bestaande customer messages met WhatsApp channel indicator:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  📬 Klantberichten                                                          │
│                                                                             │
│  [Alle] [📧 Email (12)] [📱 WhatsApp (3)] [Ongelezen (2)]                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📱 Marie de Vries                                 10 min geleden    │   │
│  │ Re: Bestelling #0042                                                │   │
│  │ "Hoi! Is die lamp ook in zwart beschikbaar?"                       │   │
│  │ ─────────────────────────────────────────────────────────────────   │   │
│  │ 📧 Jan Bakker                                     2 uur geleden    │   │
│  │ Vraag over levertijd                                               │   │
│  │ "Wanneer kan ik mijn bestelling verwachten?"                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Customer Opt-in UI (Checkout)

```text
┌─────────────────────────────────────────┐
│  📱 WhatsApp updates                    │
│                                         │
│  ☑️ Ontvang bestel- en verzend updates  │
│     via WhatsApp                        │
│                                         │
│  Telefoonnummer: +31 6 ________         │
│                                         │
│  ℹ️ Je kunt je altijd afmelden via     │
│     instellingen of door STOP te        │
│     sturen.                             │
│                                         │
└─────────────────────────────────────────┘
```

## Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| **Database** | | |
| `supabase/migrations/xxx_whatsapp_tables.sql` | Nieuw | Tabellen voor WhatsApp connecties, templates |
| **Edge Functions** | | |
| `supabase/functions/send-whatsapp-message/index.ts` | Nieuw | Verstuur WhatsApp berichten via Cloud API |
| `supabase/functions/whatsapp-webhook/index.ts` | Nieuw | Ontvang inkomende berichten + status updates |
| **Hooks** | | |
| `src/hooks/useWhatsAppConnection.ts` | Nieuw | WhatsApp account management |
| `src/hooks/useWhatsAppTemplates.ts` | Nieuw | Template CRUD |
| `src/hooks/useWhatsAppMessages.ts` | Nieuw | Berichten versturen/ontvangen |
| **Components** | | |
| `src/components/admin/settings/WhatsAppSettings.tsx` | Nieuw | Hoofd settings pagina |
| `src/components/admin/settings/WhatsAppConnectionCard.tsx` | Nieuw | Verbinding status |
| `src/components/admin/settings/WhatsAppTemplatesTable.tsx` | Nieuw | Templates beheer |
| `src/components/admin/settings/WhatsAppAutomationSettings.tsx` | Nieuw | Automatische berichten config |
| `src/components/admin/inbox/WhatsAppConversation.tsx` | Nieuw | Chat-achtige weergave |
| `src/components/checkout/WhatsAppOptIn.tsx` | Nieuw | Checkout opt-in component |
| **Updates** | | |
| `src/components/admin/settings/NotificationSettings.tsx` | Update | Link naar WhatsApp settings |
| `src/components/admin/CustomerMessageDialog.tsx` | Update | Channel selector (Email/WhatsApp) |
| `src/hooks/useCustomerMessages.ts` | Update | Support voor WhatsApp channel |
| `src/pages/admin/Settings.tsx` | Update | WhatsApp sectie toevoegen |

## Technische Details

### WhatsApp Cloud API Integratie

```typescript
// Meta Cloud API endpoint
const WHATSAPP_API = 'https://graph.facebook.com/v18.0';

// Template message versturen
async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string,
  components: TemplateComponent[]
) {
  const response = await fetch(
    `${WHATSAPP_API}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    }
  );
  return response.json();
}
```

### Webhook Verificatie

```typescript
// Webhook verification (GET request)
if (req.method === 'GET') {
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  
  if (mode === 'subscribe' && token === storedVerifyToken) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}
```

### Order Status Triggers

```typescript
// In order status change handler
if (order.status === 'paid' && tenant.whatsapp_order_confirmation) {
  await sendWhatsAppMessage({
    template_type: 'order_confirmation',
    customer_id: order.customer_id,
    order_id: order.id,
  });
}

if (order.status === 'shipped' && tenant.whatsapp_shipping_updates) {
  await sendWhatsAppMessage({
    template_type: 'shipping_update',
    customer_id: order.customer_id,
    order_id: order.id,
    variables: {
      tracking_url: order.tracking_url,
      carrier: order.shipping_carrier,
    },
  });
}
```

## API Key Vereisten

De volgende secrets moeten worden geconfigureerd:

| Secret | Beschrijving |
|--------|--------------|
| `WHATSAPP_ACCESS_TOKEN` | Meta Business access token (per-tenant opgeslagen) |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Meta Business Account ID |

*Noot: Deze worden per tenant versleuteld opgeslagen in de `whatsapp_connections` tabel.*

## Implementatie Volgorde

1. **Database Migration** - Tabellen voor connections, templates, customer fields
2. **Edge Functions** - send-whatsapp-message + webhook receiver
3. **Connection Setup** - WhatsApp Business koppeling UI
4. **Template Management** - Template CRUD + preview
5. **Automation Triggers** - Order/shipping status hooks
6. **Abandoned Cart** - Cron job voor winkelwagen reminders
7. **Inbox Integration** - WhatsApp berichten in customer inbox
8. **Checkout Opt-in** - Klant opt-in bij afrekenen

## Resultaat

Na implementatie:
- Klanten ontvangen order bevestigingen via WhatsApp
- Automatische track & trace updates wanneer pakket onderweg is
- Verlaten winkelwagen herinneringen (optioneel)
- Klanten kunnen reageren → bericht komt in SellQo inbox
- Merchants kunnen antwoorden vanuit het dashboard
- Volledige conversatie geschiedenis per klant

