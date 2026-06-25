# Publiek SellQo support-adres → `info@sellqo.app`

## Bevinding
Sweep op alle `@sellqo.app`-adressen in `src/` toont dat de meeste publieke pagina's al `info@sellqo.app` gebruiken (`About.tsx`, `LandingFooter.tsx`, en de tekst onderaan `Contact.tsx`). Twee overblijvers in publieke marketing-UI verwijzen nog naar een ander adres:

1. `src/pages/public/Contact.tsx` regels 22-27 — E-mail-contactkaart toont `hello@sellqo.app` (zowel `value` als `mailto:`-link).
2. `src/pages/Pricing.tsx` regel 58 — Enterprise CTA opent `mailto:sales@sellqo.app?subject=Enterprise%20Plan`.

Alle overige `@sellqo.app`-treffers zitten in:
- **Mail-logica / edge functions / `_shared/emailSenders.ts`** → niet aanraken (zoals gevraagd).
- **Tenant-templates en docs** (`docs/email-architecture.md`, `docs/role-audit.md`, `docs/email-design-system.md`) → niet aanraken.

## Wijziging
**`src/pages/public/Contact.tsx`** (regels 22-27)
- `value`: `info@sellqo.app`
- `href`: `mailto:info@sellqo.app`

**`src/pages/Pricing.tsx`** (regel 58)
- `mailto:sales@sellqo.app?subject=Enterprise%20Plan` → `mailto:info@sellqo.app?subject=Enterprise%20Plan`

## Buiten scope (bewust niet aangeraakt)
- `supabase/functions/_shared/emailSenders.ts` en alle 14 dedicated senders (`support@`, `invite@`, `billing@`, `noreply@`, enz.) — dit is de mail-infrastructuur.
- Alle edge functions, e-mailtemplates, en `reply_to`-routing.
- Tenant-gerelateerde adressen (`tenant.support_email`, `owner_email`).
- Documentatie in `docs/` (beschrijft de bestaande infra).

## Open vraag
Pricing-Enterprise CTA gaat nu naar `sales@sellqo.app`. Wil je die ook omleiden naar `info@sellqo.app`, of moet `sales@` behouden blijven? Ik neem in het plan aan: **omleiden naar `info@`**, omdat je zei "overal". Laat het weten als `sales@` moet blijven.

## Verificatie
Na de edit één `rg -n "hello@sellqo|sales@sellqo" src` om te bevestigen dat er niets meer overblijft in publieke UI.
