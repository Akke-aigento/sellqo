
# Plan: Meta Messages (Facebook & Instagram) Toevoegen aan Unified Inbox

## Analyse

De bestaande Unified Inbox architectuur is **uitstekend voorbereid** voor uitbreiding. De `customer_messages` tabel fungeert als universele opslag voor alle kanalen, en het WhatsApp webhook patroon kan direct hergebruikt worden voor Facebook Messenger en Instagram DMs.

### Waarom Dit Goed Past

| Aspect | Huidige Situatie | Meta Messages Fit |
|--------|------------------|-------------------|
| **Webhook Pattern** | WhatsApp gebruikt Meta Graph API webhooks | Facebook/Instagram gebruiken **dezelfde** Meta Graph API |
| **Database** | `channel` kolom accepteert string values | Voeg `facebook` en `instagram` toe |
| **Social Connections** | `social_channel_connections` tabel bestaat al | Credentials kunnen hier opgeslagen worden |
| **Meta App** | Waarschijnlijk al een Meta App voor WhatsApp | Zelfde app kan Messenger/Instagram permissions krijgen |

### Meta Messaging API's

| Platform | API | Webhook Events |
|----------|-----|----------------|
| Facebook Messenger | Messenger Platform API | `messaging`, `messaging_postbacks` |
| Instagram DMs | Instagram Graph API | `messages`, `messaging_postbacks` |

Beide gebruiken hetzelfde webhook formaat als WhatsApp, met kleine verschillen in de payload structuur.

---

## Implementatie Overzicht

### Fase 1: Database Updates

**Wijzigingen aan `customer_messages` tabel:**
- Voeg nieuwe channel types toe: `facebook`, `instagram`
- Voeg kolommen toe voor platform-specifieke IDs

```sql
-- Add new channel types
ALTER TABLE customer_messages 
DROP CONSTRAINT IF EXISTS customer_messages_channel_check;

ALTER TABLE customer_messages 
ADD CONSTRAINT customer_messages_channel_check 
CHECK (channel IN ('email', 'whatsapp', 'sms', 'facebook', 'instagram'));

-- Add Meta platform specific columns
ALTER TABLE customer_messages
ADD COLUMN IF NOT EXISTS meta_sender_id TEXT,
ADD COLUMN IF NOT EXISTS meta_page_id TEXT,
ADD COLUMN IF NOT EXISTS meta_message_id TEXT;
```

**Nieuwe tabel voor Meta Messaging connections:**

```sql
CREATE TABLE public.meta_messaging_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  page_id TEXT NOT NULL,
  page_name TEXT,
  page_access_token TEXT NOT NULL, -- Encrypted
  instagram_account_id TEXT, -- Only for Instagram
  webhook_verify_token TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, platform, page_id)
);
```

### Fase 2: Edge Functions

**Nieuw bestand: `supabase/functions/meta-messaging-webhook/index.ts`**

Unified webhook handler voor zowel Facebook Messenger als Instagram DMs:

```typescript
// Key differences from WhatsApp:
// 1. Identify platform from webhook payload (messaging vs instagram)
// 2. Use page_id instead of phone_number_id for connection lookup
// 3. Handle platform-specific message formats

// Inbound message structure:
// - Facebook: entry[].messaging[].message.text
// - Instagram: entry[].messaging[].message.text (same structure)
// - Sender ID: entry[].messaging[].sender.id (PSID for FB, IGSID for IG)
```

**Nieuw bestand: `supabase/functions/send-meta-message/index.ts`**

Send messages via Facebook Messenger of Instagram API:

```typescript
// POST to: https://graph.facebook.com/v18.0/{page_id}/messages
// Body: { recipient: { id: sender_id }, message: { text: "..." } }
// Header: Authorization: Bearer {page_access_token}
```

### Fase 3: Frontend Updates

**1. TypeScript Types (`src/hooks/useInbox.ts`)**

```diff
 export interface InboxMessage {
   // ...existing fields...
-  channel: 'email' | 'whatsapp' | 'sms';
+  channel: 'email' | 'whatsapp' | 'sms' | 'facebook' | 'instagram';
+  meta_sender_id?: string;
+  meta_page_id?: string;
 }

 export interface InboxFilters {
-  channel: 'all' | 'email' | 'whatsapp';
+  channel: 'all' | 'email' | 'whatsapp' | 'facebook' | 'instagram' | 'social';
   // 'social' = grouped filter for WhatsApp + Facebook + Instagram
 }
```

**2. Inbox Filters (`src/components/admin/inbox/InboxFilters.tsx`)**

Voeg tabs toe voor Facebook en Instagram, of groepeer ze onder "Social":

```text
┌───────────────────────────────────────────────────────────────┐
│ [Alle] [Email] [Social ▾]                                     │
│                 └── WhatsApp (5)                              │
│                     Facebook (3)                              │
│                     Instagram (2)                             │
└───────────────────────────────────────────────────────────────┘
```

**3. Reply Composer (`src/components/admin/inbox/ReplyComposer.tsx`)**

```diff
- const [channel, setChannel] = useState<'email' | 'whatsapp'>(...)
+ const [channel, setChannel] = useState<'email' | 'whatsapp' | 'facebook' | 'instagram'>(...)

+ } else if (channel === 'facebook' || channel === 'instagram') {
+   const { error } = await supabase.functions.invoke('send-meta-message', {
+     body: {
+       tenant_id: currentTenant.id,
+       platform: channel,
+       recipient_id: conversation.customer?.meta_sender_id,
+       page_id: conversation.lastMessage.meta_page_id,
+       message: message.trim(),
+     },
+   });
```

**4. Message Bubble (`src/components/admin/inbox/MessageBubble.tsx`)**

Voeg icons toe voor Facebook en Instagram:

```typescript
import { Facebook, Instagram } from 'lucide-react'; // Of custom icons

const ChannelIcon = {
  email: Mail,
  whatsapp: MessageSquare,
  facebook: Facebook,      // Blauw icon
  instagram: Instagram,    // Gradient/paars icon
}[message.channel];
```

**5. Conversation Item (`src/components/admin/inbox/ConversationItem.tsx`)**

Voeg visuele indicators toe:

```typescript
// Badge colors per channel
const channelColors = {
  email: 'bg-blue-100 text-blue-700',
  whatsapp: 'bg-green-100 text-green-700',
  facebook: 'bg-indigo-100 text-indigo-700',
  instagram: 'bg-pink-100 text-pink-700',
};
```

### Fase 4: Settings Page voor Meta Connections

**Nieuw component: `src/components/admin/settings/MetaMessagingSettings.tsx`**

```text
┌─────────────────────────────────────────────────────────────┐
│ Meta Messaging Koppelingen                                  │
├─────────────────────────────────────────────────────────────┤
│ [Facebook Icon] Facebook Messenger                          │
│ Status: ● Verbonden met "Mijn Webshop"                     │
│ [Beheren] [Ontkoppelen]                                    │
├─────────────────────────────────────────────────────────────┤
│ [Instagram Icon] Instagram Direct                           │
│ Status: ○ Niet verbonden                                   │
│ [Verbinden via Facebook Business Suite]                    │
└─────────────────────────────────────────────────────────────┘
```

### Fase 5: OAuth Flow voor Meta Permissions

De bestaande `social-oauth-init` en `social-oauth-callback` edge functions moeten uitgebreid worden om Messaging permissions te vragen:

```typescript
// Additional scopes needed:
// - pages_messaging (for Facebook Messenger)
// - instagram_manage_messages (for Instagram DMs)
// - pages_manage_metadata (for webhook subscription)
```

---

## Bestanden Overzicht

### Nieuwe Bestanden

| Bestand | Doel |
|---------|------|
| `supabase/functions/meta-messaging-webhook/index.ts` | Webhook handler voor FB/IG berichten |
| `supabase/functions/send-meta-message/index.ts` | Verstuur berichten via FB/IG |
| `src/components/admin/settings/MetaMessagingSettings.tsx` | Settings UI voor connections |
| `src/hooks/useMetaMessaging.ts` | Hook voor Meta messaging functionaliteit |

### Aangepaste Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useInbox.ts` | Nieuwe channel types, customer fields |
| `src/components/admin/inbox/InboxFilters.tsx` | Facebook/Instagram filter tabs |
| `src/components/admin/inbox/ReplyComposer.tsx` | Send via FB/IG support |
| `src/components/admin/inbox/MessageBubble.tsx` | FB/IG icons en styling |
| `src/components/admin/inbox/ConversationItem.tsx` | Channel badges |
| `supabase/functions/social-oauth-init/index.ts` | Messaging permissions |
| `supabase/functions/social-oauth-callback/index.ts` | Handle messaging scopes |

### Database Migraties

| Migratie | Doel |
|----------|------|
| `add_meta_messaging_channels.sql` | Channel types uitbreiden |
| `create_meta_messaging_connections.sql` | Connections tabel |
| `add_meta_message_columns.sql` | Platform-specifieke kolommen |

---

## Technische Overwegingen

### 1. Meta App Configuration

Je huidige Meta App voor WhatsApp kan uitgebreid worden met:
- **Messenger** product (voor Facebook pages)
- **Instagram** product (voor Instagram Business accounts)

Beide vereisen:
- Webhook subscription voor `messages` events
- Page Access Tokens met juiste permissions

### 2. Customer Matching

Voor Facebook/Instagram moeten we klanten matchen op:
- `meta_sender_id` (PSID voor Facebook, IGSID voor Instagram)
- Of via email als de klant die heeft gedeeld

Nieuw veld in `customers` tabel:

```sql
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS facebook_psid TEXT,
ADD COLUMN IF NOT EXISTS instagram_id TEXT;
```

### 3. Rate Limits

| Platform | Rate Limit |
|----------|------------|
| Facebook Messenger | 200 calls/hour per page |
| Instagram DMs | 1000 messages/day per account |

Implementeer queue-based sending voor hoge volumes.

### 4. 24-Hour Window Rule

Net als WhatsApp heeft Facebook/Instagram een 24-uurs regel:
- Na 24 uur zonder klantinteractie kun je alleen "message tags" gebruiken
- Of de klant moet opnieuw een bericht sturen

---

## Visueel Eindresultaat

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Klantgesprekken                                                         │
├────────────────────────────┬────────────────────────────────────────────┤
│ [Alle] [Email] [Social ▾] │                                            │
│                            │  Jan de Vries                              │
│ ┌────────────────────────┐ │  ────────────────────────────────────────  │
│ │ [IG] Emma Bakker   2m  │ │  [FB] Hallo, ik heb een vraag over        │
│ │ Heb je nog voorraad?   │ │  mijn bestelling #1234                    │
│ └────────────────────────┘ │                                     14:32  │
│ ┌────────────────────────┐ │                                            │
│ │ [FB] Jan de Vries  5m  │ │  [Jij] Hoi Jan! Ja, je bestelling is      │
│ │ Vraag over bestelling  │ │  onderweg. Tracking: 3SXXXX               │
│ └────────────────────────┘ │                                     14:35  │
│ ┌────────────────────────┐ │                                            │
│ │ [WA] Pieter Jansen 1u  │ │  ────────────────────────────────────────  │
│ │ Is dit ook in blauw?   │ │                                            │
│ └────────────────────────┘ │  [Email] [WhatsApp] [Facebook] [Instagram] │
│                            │  ┌────────────────────────────────────────┐│
│                            │  │ Typ je antwoord...                     ││
│                            │  └────────────────────────────────────────┘│
└────────────────────────────┴────────────────────────────────────────────┘
```

---

## Implementatie Volgorde

| Stap | Actie | Prioriteit |
|------|-------|------------|
| 1 | Database migraties uitvoeren | Hoog |
| 2 | `meta-messaging-webhook` edge function | Hoog |
| 3 | `send-meta-message` edge function | Hoog |
| 4 | Frontend types en filters updaten | Hoog |
| 5 | ReplyComposer FB/IG support | Hoog |
| 6 | Message/Conversation UI updates | Medium |
| 7 | Settings page voor connections | Medium |
| 8 | OAuth flow uitbreiden | Medium |
| 9 | Customer matching logica | Medium |
| 10 | Rate limiting en error handling | Laag |

---

## Samenvatting

| Aspect | Details |
|--------|---------|
| **Nieuwe kanalen** | Facebook Messenger + Instagram DMs |
| **Hergebruik** | WhatsApp webhook pattern, Meta Graph API |
| **Database** | 2 nieuwe tabellen, 3 kolom toevoegingen |
| **Edge Functions** | 2 nieuwe, 2 aangepast |
| **Frontend** | 5 componenten aangepast |
| **Tijdsinschatting** | ~4-6 uur implementatie |
