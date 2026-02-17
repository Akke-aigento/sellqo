

# List-Unsubscribe header toevoegen aan uitgaande emails

## Wat

Een `List-Unsubscribe` header toevoegen aan alle uitgaande emails vanuit de `send-customer-message` Edge Function. Dit verbetert de mail-tester score en zorgt ervoor dat email clients (Gmail, Outlook) een nette "uitschrijven" knop tonen in plaats van de email als spam te markeren.

## Aanpak

### Edge Function: `supabase/functions/send-customer-message/index.ts`

In het `emailHeaders` object (rond regel 191) worden twee headers toegevoegd:

- `List-Unsubscribe`: met een `mailto:` link naar het reply-to adres van de tenant, met subject "Unsubscribe"
- `List-Unsubscribe-Post`: met waarde `List-Unsubscribe=One-Click` (vereist door RFC 8058 en Gmail)

```typescript
// Altijd List-Unsubscribe toevoegen
emailHeaders['List-Unsubscribe'] = `<mailto:${replyToEmail}?subject=Unsubscribe>`;
emailHeaders['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
```

De `...(Object.keys(emailHeaders).length > 0 && { headers: emailHeaders })` conditie op regel 207 zorgt er al voor dat headers worden meegegeven, dus verder hoeft er niets te veranderen.

### Resultaat

- Gmail/Outlook tonen een "Uitschrijven" knop bovenaan de email
- Mail-tester score verbetert (de "geen List-Unsubscribe" waarschuwing verdwijnt)
- Geen database wijzigingen nodig
- Eén bestand wordt aangepast

