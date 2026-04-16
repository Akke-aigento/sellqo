

# Plan: Alle mails via noreply@sellqo.app

## Probleem
Drie edge functions gebruiken nog afwijkende afzenderadressen:
- `send-invoice-email`: `facturen@sellqo.app`
- `send-return-email`: `retouren@sellqo.app`
- `storefront-customer-api`: `noreply@sellqo.nl`

Alle overige functies gebruiken al `noreply@sellqo.app`.

## Wijzigingen

| Bestand | Huidig | Wordt |
|---------|--------|-------|
| `supabase/functions/send-invoice-email/index.ts` | `facturen@sellqo.app` (2×) | `noreply@sellqo.app` |
| `supabase/functions/send-return-email/index.ts` | `retouren@sellqo.app` | `noreply@sellqo.app` |
| `supabase/functions/storefront-customer-api/index.ts` | `noreply@sellqo.nl` | `noreply@sellqo.app` |

Drie bestanden, puur zoek-en-vervang op het e-mailadres. Daarna alle drie deployen.

