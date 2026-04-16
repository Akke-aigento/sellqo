

# Plan: Welkomstmail via Resend sturen (zoals alle andere mails)

## Probleem
De `newsletterSubscribe` functie in `storefront-api` roept `send-transactional-email` aan — een edge function die niet bestaat in dit project. Alle andere mails (facturen, campagnes, notificaties, team-uitnodigingen) gebruiken Resend rechtstreeks. De welkomstmail moet hetzelfde patroon volgen.

## Wijziging

**Bestand:** `supabase/functions/storefront-api/index.ts` (regels ~2663-2684)

De huidige `fetch` naar `send-transactional-email` vervangen door een directe Resend-aanroep, volgens exact hetzelfde patroon als `send-campaign-batch`:

```typescript
const resendApiKey = Deno.env.get('RESEND_API_KEY');
if (resendApiKey) {
  const { Resend } = await import("https://esm.sh/resend@2.0.0");
  const resend = new Resend(resendApiKey);
  await resend.emails.send({
    from: `${tenantName || 'Sellqo'} <noreply@sellqo.app>`,
    to: [email],
    subject: processedSubject,
    html: processedBody,
  });
}
```

- Gebruikt `RESEND_API_KEY` die al geconfigureerd is
- Stuurt vanuit `noreply@sellqo.app` (zelfde als campagnemails)
- De variabele-vervanging (voornaam, bedrijfsnaam, website) blijft exact zoals het nu is
- Fouten worden gelogd maar blokkeren de inschrijving niet

Geen andere bestanden hoeven te wijzigen. Geen nieuwe edge functions, geen extra infrastructuur.

