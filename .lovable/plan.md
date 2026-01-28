
# Payout Handlers Verplaatsen naar Platform Webhook

## Probleem
Je hebt slechts één webhook geconfigureerd in Stripe: **"Sellqo Platform"** die wijst naar `platform-stripe-webhook`. De payout handlers die ik heb toegevoegd staan in `stripe-connect-webhook`, die niet actief is in Stripe.

## Oplossing
De payout event handlers verplaatsen van `stripe-connect-webhook` naar `platform-stripe-webhook`.

---

## Technische Wijzigingen

### Bestand: `supabase/functions/platform-stripe-webhook/index.ts`

**Toevoegen:**

1. **Helper functie `sendPayoutNotification()`**
   - Zoekt tenant via `stripe_customer_id` (in plaats van stripe_account_id)
   - Roept `send_notification` RPC aan

2. **Helper functies voor formatting:**
   - `formatAmount()` - Converteert cents naar euros met symbool
   - `formatDate()` - Formatteert timestamp naar NL-BE datum

3. **Nieuwe case handlers in de switch:**

```text
case "payout.created":
  → Notificatie: "Uitbetaling gepland: €X op DD-MM-YYYY"
  → Type: payout_available
  → Priority: medium

case "payout.paid":
  → Notificatie: "Uitbetaling ontvangen: €X"
  → Type: payout_completed
  → Priority: low

case "payout.failed":
  → Notificatie: "Uitbetaling mislukt - actie vereist"
  → Type: stripe_account_issue
  → Priority: urgent

case "payout.canceled":
  → Notificatie: "Uitbetaling geannuleerd: €X"
  → Type: payout_available
  → Priority: medium
```

---

## Belangrijk Verschil

**Platform webhook** gebruikt `stripe_customer_id` om tenants te vinden (voor platform subscriptions).

Voor payouts moeten we tenants zoeken via `stripe_account_id` (Connect accounts).

Dit betekent dat de helper functie moet checken op beide velden:
1. Eerst `stripe_account_id` (voor Connect payouts van merchants)
2. Dan `stripe_customer_id` (voor platform payouts naar het platform zelf)

---

## Resultaat

Na implementatie:
- Payout events worden correct ontvangen door je bestaande webhook
- Merchants krijgen automatisch notificaties over hun uitbetalingen
- Geen nieuwe webhook nodig in Stripe Dashboard

---

## Implementatie Stappen

| Stap | Actie |
|------|-------|
| 1 | Helper functies toevoegen aan `platform-stripe-webhook` |
| 2 | Payout case handlers toevoegen aan switch statement |
| 3 | Edge function deployen |
| 4 | Testen met "Send test webhook" in Stripe Dashboard |
