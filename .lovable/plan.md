

## Fix: Automatische aanhef/afsluiting + reply-to routing

### Issue 1: "Beste klant" en "Met vriendelijke groet" worden dubbel toegevoegd

De tenant typt het bericht in de dialog (bijv. "Goedenavond Brecht, Wij hebben uw retourverzoek ontvangen..."). Maar de edge function `send-customer-message/index.ts` wikkelt dat bericht in een HTML-template die **automatisch** toevoegt:
- Regel 107: `Beste ${customer_name || 'klant'},` (aanhef)
- Regel 138-140: `Met vriendelijke groet, ${fromName}` (afsluiting)

Het resultaat: de tenant's eigen aanhef + de automatische aanhef, en de tenant's eigen afsluiting + de automatische afsluiting. Vandaar de dubbele "Met vriendelijke groet, VanXcel" in de screenshot.

**Fix**: Verwijder de hardcoded aanhef (regel 106-108) en afsluiting (regel 137-141) uit de HTML-template. De tenant bepaalt zelf wat er in het bericht staat — de template moet alleen de wrapper (header, footer, styling) toevoegen, niet de inhoud aanpassen.

### Issue 2: Antwoorden komen in info@vanxcel.com, niet in SellQo

Regel 75: `const replyToEmail = tenant.owner_email || "noreply@sellqo.app";`
Regel 207: `reply_to: replyToEmail`

De `reply_to` wordt ingesteld op `tenant.owner_email` — dat is `info@vanxcel.com`. Dus als een klant antwoordt, gaat het naar die mailbox en niet naar SellQo.

**Fix**: Dit hangt af van of SellQo inbound email processing actief is. Als dat zo is, moet reply-to naar het SellQo inbound-adres wijzen (bijv. een uniek doorsturadres per tenant). Als inbound niet actief is, is het huidige gedrag eigenlijk correct — antwoorden gaan naar de tenant's eigen mailbox.

Ik ga even checken hoe inbound email werkt in dit project.

### Bestanden

| Bestand | Wijziging |
|---|---|
| `supabase/functions/send-customer-message/index.ts` | Verwijder hardcoded "Beste klant" aanhef en "Met vriendelijke groet" afsluiting uit de HTML-template. Tenant's `body_html` wordt direct in de content-sectie geplaatst zonder extra tekst eromheen. |

### Wat er overblijft in de template
- Header met logo/naam (branding)
- De `body_html` van de tenant (ongewijzigd)
- Optioneel bestel-/offerteblok
- Footer met adresgegevens

### Reply-to gedrag
Het huidige gedrag (`reply_to: tenant.owner_email`) is by design — antwoorden gaan naar de tenant's eigen mailbox. Als je wilt dat antwoorden in de SellQo inbox terechtkomen, moet de inbound email forwarding actief zijn en de reply-to naar het SellQo forwarding-adres wijzen. Dit is een apart configuratiepunt dat nu al werkt via de inbox-instellingen. Geen wijziging nodig tenzij je dit expliciet wilt veranderen.

