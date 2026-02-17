

# PDF als bijlage toevoegen aan factuur-e-mails

## Probleem

Odoo (en veel andere boekhoudpakketten) vereisen dat de factuur-PDF daadwerkelijk als **bijlage** aan de e-mail hangt. Het huidige systeem stuurt alleen downloadlinks mee in de HTML-body. Odoo weigert de e-mail daarom met: *"please ensure a PDF or electronic invoice file is attached"*.

## Oplossing

De `send-invoice-email` Edge Function aanpassen zodat:

1. De factuur-PDF wordt **opgehaald** uit storage (via de `pdf_url`)
2. De PDF als **echte bijlage** wordt meegestuurd via Resend's `attachments` parameter
3. Optioneel ook het UBL/XML-bestand als bijlage (indien tenant `ubl` of `both` als formaat heeft)
4. De downloadlinks blijven ook in de e-mail staan (handig voor de klant)

## Technische details

### `supabase/functions/send-invoice-email/index.ts`

**Stap 1** - Na het ophalen van de invoice data, de PDF downloaden:

```
// Download PDF from storage URL
const attachments = [];

if (invoice.pdf_url) {
  const pdfResponse = await fetch(invoice.pdf_url);
  const pdfBuffer = await pdfResponse.arrayBuffer();
  const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
  
  attachments.push({
    filename: `${invoice.invoice_number}.pdf`,
    content: pdfBase64,
  });
}

// Optionally attach UBL/XML
if (invoice.ubl_url && (invoiceFormat === 'ubl' || invoiceFormat === 'both')) {
  const ublResponse = await fetch(invoice.ubl_url);
  const ublBuffer = await ublResponse.arrayBuffer();
  const ublBase64 = btoa(String.fromCharCode(...new Uint8Array(ublBuffer)));
  
  attachments.push({
    filename: `${invoice.invoice_number}.xml`,
    content: ublBase64,
  });
}
```

**Stap 2** - Bijlagen meesturen in beide e-mails (klant + kopie naar boekhouding):

```
await resend.emails.send({
  from: ...,
  to: ...,
  subject: ...,
  html: emailHtml,
  attachments: attachments,  // <-- PDF als bijlage
});
```

De kopie-e-mail naar Odoo/boekhouding krijgt dezelfde bijlagen mee.

## Resultaat

- Odoo ontvangt de factuur-PDF als bijlage en kan deze automatisch verwerken
- Klanten krijgen de PDF ook direct als bijlage (plus de downloadlink in de e-mail)
- UBL/XML wordt optioneel ook als bijlage meegestuurd
