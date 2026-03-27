

## Fix: Factuurstatus nooit op "betaald" gezet + Build Errors

### Root cause facturen

De `generate-invoice` edge function maakt facturen aan met:
- `status: 'draft'` (regel 1379)
- `paid_at: new Date().toISOString()` (regel 1386)

Na het versturen van de e-mail zet `send-invoice-email` de status op `'sent'`. **Maar er is nergens code die de status op `'paid'` zet.** Resultaat: 53 facturen op "draft" (e-mail niet verstuurd) en 68 op "sent" (e-mail wel verstuurd), terwijl de orders allemaal betaald zijn.

### Oplossing

**1. `generate-invoice/index.ts`** — Status juist zetten bij aanmaken
- Als de order `payment_status === 'paid'` is: maak de factuur aan met `status: 'paid'` i.p.v. `'draft'`
- Als de order nog niet betaald is: gebruik `'draft'` en laat `paid_at` leeg

**2. `send-invoice-email/index.ts`** — Status niet terugzetten naar 'sent' als al 'paid'
- Check huidige status: als die al `'paid'` is, update alleen `sent_at` (niet de status)

**3. Database fix** — Bestaande facturen corrigeren via migratie
```sql
UPDATE invoices 
SET status = 'paid' 
WHERE paid_at IS NOT NULL 
  AND status IN ('draft', 'sent');
```

### Build errors fixen

**4. Test bestanden** — 3 bestanden met TypeScript fouten:

| Bestand | Fout | Fix |
|---|---|---|
| `src/test/billing/plan-switch.test.ts` (regel 24) | `as Record<string, boolean>` cast | `as unknown as Record<string, boolean>` |
| `src/test/scenarios/subscription-lifecycle.test.ts` (regels 161, 185) | Zelfde cast fout | Zelfde fix |
| `src/test/hooks/useTenantSubscription.test.ts` (regel 2) | `waitFor` import ontbreekt | Verwijder `waitFor` uit import of gebruik `vi.waitFor` |
| `src/test/hooks/useTrialStatus.test.ts` (regel 2) | Zelfde `waitFor` import | Zelfde fix |

### Bestanden

| Bestand | Wijziging |
|---|---|
| `supabase/functions/generate-invoice/index.ts` | Status `'paid'` als order betaald is |
| `supabase/functions/send-invoice-email/index.ts` | Niet overschrijven als al `'paid'` |
| Nieuwe migratie | Bestaande facturen updaten naar `'paid'` |
| `src/test/billing/plan-switch.test.ts` | Cast fix |
| `src/test/scenarios/subscription-lifecycle.test.ts` | Cast fix |
| `src/test/hooks/useTenantSubscription.test.ts` | Import fix |
| `src/test/hooks/useTrialStatus.test.ts` | Import fix |

