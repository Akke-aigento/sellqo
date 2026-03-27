

## Stripe Webhook Configuratie

### Webhook URL
De webhook moet in het Stripe Dashboard worden geconfigureerd:

**URL:** `https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/platform-stripe-webhook`

**Events die aan moeten staan:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.paid`
- `invoice.payment_failed`
- `checkout.session.completed`
- `payout.created`
- `payout.paid`
- `payout.failed`
- `payout.canceled`

**Benodigde secrets:**
- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_WEBHOOK_SECRET` — Webhook signing secret uit Stripe Dashboard
