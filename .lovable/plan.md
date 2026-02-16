

# Fix: BCC e-mail komt niet aan bij Bol.com orders

## Probleem

Resend accepteert de e-mail (je krijgt een `id` terug), maar Bol.com proxy-adressen (`@verkopen.bol.com`) droppen e-mails van externe afzenders silently. De BCC naar Odoo is afhankelijk van dezelfde e-mail call, waardoor die ook niet aankomt.

## Oorzaak

De huidige code stuurt alles in 1 Resend API-call:
```
to: ["...@verkopen.bol.com"]
bcc: ["verkoopdagboek-shopify@nomadix-bv.odoo.com"]
```

Wanneer de primaire `to`-delivery faalt (Bol.com dropt de mail), wordt de BCC ook niet afgeleverd.

## Oplossing

### Bestand: `supabase/functions/send-invoice-email/index.ts`

De BCC/CC e-mails als **aparte Resend API-call** versturen, los van de klant-e-mail. Dit zorgt ervoor dat je boekhoudsoftware altijd de factuur ontvangt, ongeacht of de klant een marketplace proxy-adres heeft.

Concrete wijziging:

1. **Primaire e-mail**: Verstuur naar de klant (`to`) -- zonder CC/BCC
2. **Kopie-e-mail**: Als CC of BCC is ingesteld, verstuur een aparte e-mail naar die adressen met de factuur-inhoud als `to`-ontvanger
3. **Non-blocking**: Als de kopie-e-mail faalt, logt het een warning maar blokkeert het de flow niet

```typescript
// 1. Primaire e-mail naar klant
await resend.emails.send({
  from: `${tenant.name} <noreply@sellqo.app>`,
  to: toEmails,
  subject: emailSubject,
  html: emailHtml,
});

// 2. Aparte kopie naar CC/BCC adressen
const copyRecipients = [
  ...(ccEmails || []),
  ...(bccEmails || []),
];

if (copyRecipients.length > 0) {
  try {
    await resend.emails.send({
      from: `${tenant.name} <noreply@sellqo.app>`,
      to: copyRecipients,
      subject: `[Kopie] ${emailSubject}`,
      html: emailHtml,
    });
  } catch (copyError) {
    console.warn('Copy email failed (non-blocking):', copyError);
  }
}
```

## Geen database-wijzigingen nodig

De instellingen en velden werken al correct. Alleen de verzendlogica in de edge function moet worden aangepast.

## Verwacht resultaat

- Odoo ontvangt altijd de factuur, ook bij Bol.com orders
- Klant ontvangt de factuur als het e-mailadres geldig is (bij niet-marketplace orders)
- Bij marketplace orders: de klant-mail wordt door Bol.com gedropt, maar dat heeft geen invloed meer op de kopie naar je boekhouding
