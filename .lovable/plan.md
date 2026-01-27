
# Plan: Inbound Email Functie Compleet Maken

## Overzicht

Vier verbeteringen om de inbound email functie production-ready te maken:

1. **Marketplace Badge** - Visuele indicator voor Bol.com/Amazon berichten
2. **Bijlagen Opslaan** - Attachments opslaan in Supabase Storage  
3. **Order Link** - Directe link naar gekoppelde order
4. **Reply Tracking** - Markeer berichten als beantwoord

---

## 1. Marketplace Badge in UI

### MessageBubble.tsx

Voeg een marketplace indicator toe boven het bericht:

```typescript
// Detecteer marketplace uit context_data
const marketplace = (message as any).context_data?.marketplace;

// Badge component in de bubble
{marketplace === 'bol_com' && (
  <div className="flex items-center gap-1 mb-1">
    <ShoppingBag className="h-3 w-3 text-orange-500" />
    <span className="text-xs text-orange-600 font-medium">Bol.com</span>
  </div>
)}
```

### ConversationItem.tsx

Toon marketplace icoon naast channel icoon in de lijst.

---

## 2. Bijlagen Opslaan

### Database Migratie

```sql
CREATE TABLE customer_message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES customer_messages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policy
ALTER TABLE customer_message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view attachments"
  ON customer_message_attachments FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));
```

### Edge Function Update

In `handle-inbound-email/index.ts`:

```typescript
// Na message insert, upload attachments
if (payload.attachments?.length) {
  for (const attachment of payload.attachments) {
    const storagePath = `${tenantId}/messages/${message.id}/${attachment.filename}`;
    
    // Decode base64 and upload
    const bytes = Uint8Array.from(atob(attachment.content), c => c.charCodeAt(0));
    
    await supabase.storage
      .from('message-attachments')
      .upload(storagePath, bytes, {
        contentType: attachment.content_type,
      });
    
    // Save reference
    await supabase.from('customer_message_attachments').insert({
      message_id: message.id,
      tenant_id: tenantId,
      filename: attachment.filename,
      content_type: attachment.content_type,
      size_bytes: bytes.length,
      storage_path: storagePath,
    });
  }
}
```

### UI Component

Toon bijlagen onder het bericht met download links.

---

## 3. Order Link in Conversatie Header

### ConversationDetail.tsx

```typescript
// Haal order_id uit laatste bericht
const linkedOrderId = messages.find(m => m.order_id)?.order_id;

// In header, naast klantprofiel button
{linkedOrderId && (
  <Button variant="outline" size="sm" asChild>
    <Link to={`/admin/orders/${linkedOrderId}`}>
      <Package className="h-4 w-4 mr-1" />
      Bestelling
      <ExternalLink className="h-3 w-3 ml-1" />
    </Link>
  </Button>
)}
```

---

## 4. Reply Tracking (replied_at)

### ReplyComposer.tsx

Na succesvol verzenden, update het originele inbound bericht:

```typescript
// Na handleSend success
// Update laatste inbound bericht als beantwoord
const lastInbound = conversation.messages.find(
  m => m.direction === 'inbound' && !m.replied_at
);

if (lastInbound) {
  await supabase
    .from('customer_messages')
    .update({ 
      replied_at: new Date().toISOString(),
      reply_message_id: data.message_id // ID van het antwoord
    })
    .eq('id', lastInbound.id);
}
```

---

## Bestanden Overzicht

| Bestand | Wijziging |
|---------|-----------|
| `supabase/migrations/xxx.sql` | Attachments tabel + storage bucket |
| `supabase/functions/handle-inbound-email/index.ts` | Bijlagen opslaan |
| `src/components/admin/inbox/MessageBubble.tsx` | Marketplace badge + attachments |
| `src/components/admin/inbox/ConversationDetail.tsx` | Order link in header |
| `src/components/admin/inbox/ConversationItem.tsx` | Marketplace icoon |
| `src/components/admin/inbox/ReplyComposer.tsx` | replied_at update |
| `src/hooks/useInbox.ts` | context_data + order_id in query |

---

## Prioriteit

| Feature | Impact | Complexiteit |
|---------|--------|--------------|
| Reply Tracking | Hoog | Laag |
| Order Link | Hoog | Laag |
| Marketplace Badge | Medium | Laag |
| Bijlagen | Medium | Medium |

Ik raad aan te starten met **Reply Tracking** en **Order Link** - deze zijn snel te implementeren en hebben de meeste impact op de gebruikerservaring.
