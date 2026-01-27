
# Plan: Reply Flow Fix voor Bol.com Inbound Berichten

## Samenvatting

De ReplyComposer stuurt nu altijd naar het klant email-adres, maar voor Bol.com berichten moeten we de `reply_to_email` uit het originele bericht gebruiken (het geanonimiseerde `klant@klantbericht.bol.com` adres).

---

## Wat Er Mis Gaat

```text
HUIDIGE SITUATIE (FOUT)
────────────────────────────────────────────────────────────────────────────────
1. Bol.com stuurt klantvraag
   FROM: klant123@klantbericht.bol.com  (Bol.com proxy adres)
   
2. SellQo slaat op:
   reply_to_email: "klant123@klantbericht.bol.com"  ✅ Correct opgeslagen
   
3. Merchant beantwoordt via ReplyComposer
   TO: conversation.customer?.email → "jan@gmail.com"  ❌ FOUT!
   
4. Email gaat NIET via Bol.com → Klant ontvangt NIETS
────────────────────────────────────────────────────────────────────────────────

GEWENSTE SITUATIE
────────────────────────────────────────────────────────────────────────────────
1. Bol.com stuurt klantvraag
   FROM: klant123@klantbericht.bol.com
   
2. SellQo slaat op:
   reply_to_email: "klant123@klantbericht.bol.com"
   
3. Merchant beantwoordt via ReplyComposer
   TO: reply_to_email → "klant123@klantbericht.bol.com"  ✅ CORRECT!
   
4. Bol.com ontvangt reply → Forward naar klant → Klant ziet antwoord ✅
────────────────────────────────────────────────────────────────────────────────
```

---

## Wijzigingen

### 1. InboxMessage Interface Updaten

**Bestand:** `src/hooks/useInbox.ts`

Voeg `reply_to_email` toe aan de interface:

```typescript
export interface InboxMessage {
  // ... existing fields
  reply_to_email: string | null;  // ADD THIS
}
```

### 2. Conversation Interface Uitbreiden

**Bestand:** `src/hooks/useInbox.ts`

Voeg `replyToEmail` toe aan de Conversation interface:

```typescript
export interface Conversation {
  id: string;
  customer: { ... };
  lastMessage: InboxMessage;
  unreadCount: number;
  channel: 'email' | 'whatsapp' | 'mixed';
  messages: InboxMessage[];
  replyToEmail?: string;  // ADD THIS - het adres om naar te antwoorden
}
```

### 3. Reply Email Bepalen in useInbox

**Bestand:** `src/hooks/useInbox.ts`

Bij het bouwen van conversations, bepaal het juiste reply-adres:

```typescript
// In de conversation building logic
const lastInboundMessage = sortedMsgs.find(m => m.direction === 'inbound');
const replyToEmail = lastInboundMessage?.reply_to_email || customer?.email;

convos.push({
  // ... existing fields
  replyToEmail,  // ADD THIS
});
```

### 4. ReplyComposer Aanpassen

**Bestand:** `src/components/admin/inbox/ReplyComposer.tsx`

Gebruik `replyToEmail` in plaats van `customer?.email`:

```typescript
// Lijn 117-129 aanpassen:
const { error } = await supabase.functions.invoke('send-customer-message', {
  body: {
    tenant_id: currentTenant.id,
    // USE replyToEmail WITH FALLBACK
    customer_email: conversation.replyToEmail || conversation.customer?.email,
    customer_name: conversation.customer?.name,
    subject: `Re: ${conversation.lastMessage.subject || 'Uw bericht'}`,
    body_html: message.trim().replace(/\n/g, '<br>'),
    body_text: message.trim(),
    context_type: 'general',
    customer_id: conversation.customer?.id,
  },
});
```

---

## Resultaat

| Scenario | Reply-to Adres |
|----------|----------------|
| Bol.com klantvraag | `klant123@klantbericht.bol.com` (via Bol.com) |
| Amazon klantvraag | `buyer@marketplace.amazon.com` (via Amazon) |
| Directe klant email | `jan@gmail.com` (klant email) |
| WhatsApp | Gebruikt telefoon (ongewijzigd) |

---

## Bestandsoverzicht

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useInbox.ts` | Interface uitbreiding + replyToEmail logica |
| `src/components/admin/inbox/ReplyComposer.tsx` | Gebruik `replyToEmail` voor email replies |

---

## Verificatie

Na deze wijziging:
- [ ] Inbound Bol.com berichten tonen het proxy-adres
- [ ] Reply stuurt naar `reply_to_email` (niet naar klant email)
- [ ] Fallback naar klant email als `reply_to_email` leeg is
- [ ] WhatsApp flow blijft ongewijzigd
