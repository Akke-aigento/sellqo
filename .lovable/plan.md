

## Reply-to naar SellQo Inbox Routeren

### Wat er al is
De infrastructuur bestaat al volledig:
- Elke tenant heeft een `inbound_email_prefix` (bijv. `vanxcel-abc123`)
- Inbound domein is `sellqo.app` → dus het adres is `{prefix}@sellqo.app`
- De `handle-inbound-email` edge function verwerkt binnenkomende mails en koppelt ze aan de juiste tenant
- MX-record en Resend webhook zijn geconfigureerd

### Wat er fout gaat
In `send-customer-message/index.ts` regel 75:
```
const replyToEmail = tenant.owner_email || "noreply@sellqo.app";
```
Dit stuurt antwoorden naar `info@vanxcel.com` i.p.v. naar de SellQo inbox.

### Fix (1 bestand)

**`supabase/functions/send-customer-message/index.ts`**:

1. Voeg `inbound_email_prefix, inbound_email_enabled` toe aan de tenant select query (regel 67)
2. Wijzig de reply-to logica (regel 75):
   - Als `inbound_email_enabled` EN `inbound_email_prefix` bestaan → `reply_to = {prefix}@sellqo.app`
   - Anders → fallback naar `tenant.owner_email` (huidige gedrag)
3. Update de footer tekst (regel 143) zodat het het juiste adres toont

### Resultaat
- Tenant heeft inbound email AAN → klant antwoordt → mail komt in SellQo inbox
- Tenant heeft inbound email UIT → klant antwoordt → mail gaat naar tenant's eigen mailbox (huidige gedrag)
- Geen extra configuratie nodig, werkt automatisch op basis van bestaande instellingen

