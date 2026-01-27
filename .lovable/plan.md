
# Uitbreiding Betalingsinfrastructuur Plan

Dit plan integreert drie nieuwe features in het bestaande betalingssysteem:
1. **CSV Reconciliatie voor klant-orders** (naast platform payments)
2. **Notificaties voor uitbetalingen** (payout events)
3. **Bonus: Stripe payout webhook handler**

---

## 1. CSV Bank Reconciliatie Uitbreiden voor Klant-Orders

### Huidige Situatie
De `BankReconciliationUpload.tsx` component matcht momenteel alleen tegen `pending_platform_payments` tabel (platform eigen betalingen voor AI credits/add-ons).

### Uitbreiding
Klant-orders hebben ook een `ogm_reference` kolom in de `orders` tabel. De reconciliatie moet nu ook openstaande klantorders matchen.

### Wijzigingen

**Bestand: `src/components/admin/BankReconciliationUpload.tsx`**

```text
Huidige flow:
┌─────────────────┐     ┌──────────────────────────────┐
│ CSV Bank Export │ --> │ Match tegen platform_payments │
└─────────────────┘     └──────────────────────────────┘

Nieuwe flow:
┌─────────────────┐     ┌──────────────────────────────┐
│ CSV Bank Export │ --> │ 1. Match tegen orders         │
│                 │     │ 2. Match tegen platform_pay.  │
└─────────────────┘     └──────────────────────────────┘
```

**Logica aanpassingen:**
1. Eerst controleren in `orders` tabel waar:
   - `payment_method = 'bank_transfer'`
   - `payment_status = 'awaiting_payment'` of `pending`
   - `ogm_reference` = OGM uit bankafschrift
2. Bij match: order bijwerken naar `payment_status = 'paid'`
3. Audit log aanmaken in `payment_confirmations` tabel
4. Indien geen order match, dan terugvallen op `pending_platform_payments`

**Nieuwe ReconciliationResult statuses:**
- `matched_order` - Klantorder gematcht
- `matched_platform` - Platform payment gematcht
- `not_found` - Geen match
- `error` - Fout

---

## 2. Notificaties voor Uitbetalingen

### Bestaande Infrastructuur
Het notificatiesysteem is volledig geïmplementeerd:
- `send_notification()` database function
- `notifications` tabel met RLS
- `useNotifications()` hook met realtime updates
- Notification types al gedefinieerd in `src/types/notification.ts`:
  - `payout_available` - Uitbetaling beschikbaar
  - `payout_completed` - Uitbetaling voltooid

### Nieuwe Webhook Events

**Bestand: `supabase/functions/stripe-connect-webhook/index.ts`**

Toevoegen van handlers voor:

```text
case "payout.created":
  → Notificatie: "Uitbetaling gepland: €X op DD-MM-YYYY"
  → Type: payout_available, Priority: medium

case "payout.paid":
  → Notificatie: "Uitbetaling ontvangen: €X"
  → Type: payout_completed, Priority: low

case "payout.failed":
  → Notificatie: "Uitbetaling mislukt - actie vereist"
  → Type: stripe_account_issue, Priority: urgent
```

**Helper functie toevoegen:**
```typescript
async function sendPayoutNotification(
  supabase: SupabaseClient,
  stripeAccountId: string,
  type: string,
  title: string,
  message: string,
  priority: string,
  data: Record<string, unknown>
) {
  // Vind tenant via stripe_account_id
  // Roep send_notification RPC aan
}
```

---

## 3. Bonus: Stripe Webhook Registratie Instructies

De webhook moet geconfigureerd worden om payout events te ontvangen:

**Events toe te voegen in Stripe Dashboard:**
- `payout.created`
- `payout.paid`
- `payout.failed`
- `payout.canceled`

---

## Implementatie Details

### Database Wijzigingen
Geen database migraties nodig - alle tabellen bestaan al:
- `orders.ogm_reference` ✅
- `payment_confirmations` ✅
- `notifications` ✅
- `send_notification()` function ✅

### Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/BankReconciliationUpload.tsx` | Uitbreiden met orders matching |
| `supabase/functions/stripe-connect-webhook/index.ts` | Payout event handlers toevoegen |

### UI Verbetering

**Reconciliatie resultaten tabel uitbreiden:**

```text
┌─────────┬─────────┬────────────┬──────────────────┬─────────┐
│ Datum   │ Bedrag  │ OGM        │ Type             │ Status  │
├─────────┼─────────┼────────────┼──────────────────┼─────────┤
│ 27-01   │ €89,00  │ +++123/... │ 🛒 Klant Order   │ ✅ OK   │
│ 26-01   │ €25,00  │ +++456/... │ 🏢 AI Credits    │ ✅ OK   │
│ 26-01   │ €45,00  │ (geen)     │ -                │ ❌ Geen │
└─────────┴─────────┴────────────┴──────────────────┴─────────┘
```

---

## Samenvatting Deliverables

1. **CSV Reconciliatie v2**
   - Matcht nu ook klant-orders via OGM
   - Duidelijke visuele indicatie van type match
   - Audit trail via `payment_confirmations`

2. **Payout Notificaties**
   - Automatische meldingen bij uitbetalingen
   - Urgente alerts bij mislukte uitbetalingen
   - Geïntegreerd met bestaand notificatiesysteem

3. **Verbeterde Webhook**
   - Volledige payout lifecycle tracking
   - Robuuste tenant lookup via stripe_account_id

---

## Geschatte Tijdsinvestering

| Feature | Tijd |
|---------|------|
| CSV reconciliatie uitbreiden | ~2 uur |
| Payout webhook handlers | ~1 uur |
| Testing & QA | ~1 uur |
| **Totaal** | **~4 uur** |
