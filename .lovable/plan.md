
# Fix: Handle-Inbound-Email Edge Function Payload Parsing

## Het Probleem

Je configuratie is **100% correct**! Het probleem zit in de edge function code.

### Wat Resend Stuurt (Event Wrapper Format)
```json
{
  "type": "email.received",
  "created_at": "2026-01-28T10:51:36.000Z",
  "data": {
    "email_id": "msg_38soB8DurfHw4i31Cbx8DPGdAnH",
    "from": "afzender@example.com",
    "to": ["demo-bakkerij@sellqo.app"],
    "subject": "Test bericht",
    "attachments": [...]
  }
}
```

### Wat Onze Code Verwacht
```typescript
// FOUT - probeert direct payload.to te lezen
const payload: ResendInboundPayload = await req.json();
for (const toEmail of payload.to) { ... }  // ERROR: payload.to is undefined!
```

De code verwacht `payload.to` als array, maar Resend stuurt `payload.data.to`.

---

## De Oplossing

Update de edge function om de **event wrapper structuur** correct te parsen:

### Stap 1: Interface Aanpassen

```typescript
// Resend Webhook Event Wrapper
interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: ResendInboundEmailData;
}

interface ResendInboundEmailData {
  email_id: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
  message_id?: string;
  attachments?: Array<{
    id: string;
    filename: string;
    content_type: string;
    content_disposition?: string;
    content_id?: string;
  }>;
}
```

### Stap 2: Payload Extractie Aanpassen

```typescript
const webhook: ResendWebhookEvent = await req.json();

// Validate event type
if (webhook.type !== 'email.received') {
  console.log('Ignoring non-inbound event:', webhook.type);
  return new Response(JSON.stringify({ message: 'Event ignored' }), { status: 200 });
}

// Extract the email data
const payload = webhook.data;

console.log("Inbound email received:", {
  email_id: payload.email_id,
  from: payload.from,
  to: payload.to,
  subject: payload.subject,
});
```

### Stap 3: Attachments Verwerking Aanpassen

Resend's attachment formaat is ook anders dan verwacht:
- Geen `content` veld (base64 data)
- Wel een `id` veld om de attachment op te halen via API

```typescript
// Oude code verwachtte:
attachments?: Array<{
  filename: string;
  content: string;       // base64 data - ZIT HIER NIET IN!
  content_type: string;
}>;

// Nieuwe Resend format:
attachments?: Array<{
  id: string;            // UUID om op te halen
  filename: string;
  content_type: string;
  content_disposition?: string;
  content_id?: string;
}>;
```

**Opmerking**: Attachments worden door Resend apart opgeslagen en moeten via de Resend API opgehaald worden met de `id`. We kunnen dit voor nu overslaan of later implementeren.

---

## Samenvatting Wijzigingen

| Locatie | Wijziging |
|---------|-----------|
| `handle-inbound-email/index.ts` | Wrapper payload parsing toevoegen |
| Lijn 10-24 | Interface aanpassen voor Resend webhook event format |
| Lijn 95-100 | Event wrapper unwrappen voordat data wordt verwerkt |
| Lijn 188 | Headers veld is optioneel, message_id is apart veld |
| Lijn 227-268 | Attachments logic aanpassen (id-based ipv content) |

---

## Technisch Overzicht

```text
┌─────────────────────────────────────────────────────────────┐
│                    Resend Webhook                           │
│  {                                                          │
│    "type": "email.received",                                │
│    "data": {                                                │
│      "to": ["demo-bakkerij@sellqo.app"],  ← hier zit data!  │
│      "from": "...",                                         │
│      ...                                                    │
│    }                                                        │
│  }                                                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Edge Function (nu)                             │
│  payload.to ← undefined (probeert top-level)                │
│  ERROR: "payload.to is not iterable"                        │
└─────────────────────────────────────────────────────────────┘

                    NA DE FIX:

┌─────────────────────────────────────────────────────────────┐
│              Edge Function (straks)                         │
│  const webhook = await req.json();                          │
│  const payload = webhook.data;  ← unwrap first!             │
│  payload.to ← ["demo-bakkerij@sellqo.app"] ✓                │
└─────────────────────────────────────────────────────────────┘
```

Na deze fix zullen de inbound emails correct worden verwerkt en in je SellQo inbox verschijnen.
