# E-mailarchitectuur — afzenders, antwoordadressen en inbound

_Laatst bijgewerkt: 18 september 2026 (MAIL-INBOUND-1 + MAIL-SENDER-1)._

SellQo verstuurt en ontvangt mail op drie domeinen, elk met één taak.

| Domein | Waarvoor | Provider | DNS |
|---|---|---|---|
| `sellqo.app` (root) | alleen `info@sellqo.app`: platformmail en het publieke contactadres | Migadu (mailbox) + Resend (verzenden) | MX → Migadu; DMARC `p=quarantine`, `rua` → `info@sellqo.app` |
| `mail.sellqo.app` | winkels: afzender én inbound, `<prefix>@mail.sellqo.app` | Resend | DKIM `resend._domainkey.mail`; CNAME `rsend.mail` → `rsend-euw1.forge.rmta.net`; CNAME `send.mail` → `send.forge.rmta.net`; MX `mail` → `inbound-smtp.eu-west-1.amazonaws.com` (prio 10) |
| `auth.sellqo.app` | Supabase-auth-mail (login, signup, reset, e-mailwijziging) | Lovable Managed (Mailgun EU) | NS-delegatie naar Lovable |

**Regel:** op de root bestaat alleen `info@sellqo.app`. Elk ander `…@sellqo.app`-adres in de
code is fout; `scripts/check-mail-addresses.mjs` (`npm run check:mail`, ook in CI) faalt erop.

## Stream A — platform → gebruikers van een winkel

Uitnodigingen, facturatie van SellQo zelf, meldingen, beveiligingsmail. Altijd vanaf
`info@sellqo.app`; het soort mail staat in de weergavenaam.

| Key (`EMAIL_SENDERS`) | From | Reply-To |
|---|---|---|
| `invite` | `SellQo <info@sellqo.app>` | `info@sellqo.app` |
| `billing` | `SellQo Billing <info@sellqo.app>` | `info@sellqo.app` |
| `notifications` | `SellQo <info@sellqo.app>` | `info@sellqo.app` |
| `security` | `SellQo Security <info@sellqo.app>` | `info@sellqo.app` |
| `noReply` | `SellQo <info@sellqo.app>` | — |

## Stream B — winkel → klant

Orderbevestigingen, facturen, creditnota's, betaalverzoeken, offertes, retouren, cadeaukaarten,
tickets, klantenservicebericht, nieuwsbrieven en automations. Eén bouwer voor allemaal:
`tenantSender(tenant)` in `_shared/emailSenders.ts`.

- **From:** `<winkelnaam> <<prefix>@mail.sellqo.app>`. `prefix` = `tenants.inbound_email_prefix`,
  anders `slug`, gevalideerd tegen `^[a-z0-9][a-z0-9-]{0,62}$`. Zonder geldige prefix: luide fout
  in de log en From `SellQo <info@sellqo.app>` als noodval.
- **Reply-To:** `resolveCustomerContactEmail(tenant)` uit `_shared/customerContact.ts` =
  `support_email` (eigen adres, ingesteld bij Instellingen → Email Inbox) of anders de SellQo-inbox
  `<prefix>@mail.sellqo.app`. `owner_email` en `notification_email` horen hier nooit in.
- Brand-callers geven `brand.senderSource` mee (`getTenantBrand`, `_shared/tenantEmail.ts`).
- **Uitzondering: contactformulier van de webshop** (`storefront-contact-form`). Die mail gaat naar
  de winkel zelf. From is het winkeladres, Reply-To is altijd de bezoeker
  (`_shared/contactFormForward.ts`, met test).
- **List-Unsubscribe** alleen op nieuwsbrieven en automations, niet op het 1-op-1-klantenservicebericht.

## Inbound — klantmail naar de winkel

1. Een klant mailt of antwoordt naar `<prefix>@mail.sellqo.app`.
2. MX `mail.sellqo.app` → Resend Inbound → webhook `email.received` → `handle-inbound-email`
   (svix-handtekening met `RESEND_INBOUND_WEBHOOK_SECRET`).
3. `extractInboundPrefix` (`_shared/inboundAddress.ts`) haalt de prefix uit de To; alleen
   `@mail.sellqo.app` telt. De winkel wordt gevonden op `tenants.inbound_email_prefix`.
4. Het bericht komt in `customer_messages` (inbox in de admin) en er komt een melding
   (`notifications`, category `messages`, ook push).

Mail naar de root `sellqo.app` bereikt SellQo nooit: die gaat naar Migadu.

## Auth — Lovable Managed

`auth-email-hook` bouwt de templates (`_shared/email-templates/`) en zet ze in de wachtrij; Lovable
Managed verstuurt via `auth.sellqo.app` met display-From `sellqo <info@sellqo.app>`. Contactadres in
de templates: `info@sellqo.app`. Verder staat deze stroom volledig los van Resend.

## Talen

Afzendernaam = winkelnaam. De taal van de mail volgt de klant of de winkel (`tenantEmailI18n.ts`),
niet het adres.

## Historie

- Tot 18 sep 2026 had elke stroom een eigen adres op de root (`orders@`, `invoices@`,
  `support@`, `marketing@`, …). Die bestonden bij Migadu niet als mailbox; antwoorden erop gingen
  verloren, en `<prefix>@sellqo.app` als inbound kwam nooit bij SellQo aan.
- MAIL-CONTACT-1 (18 sep): `support_email` als enige bron voor het klantcontactadres.
- MAIL-INBOUND-1 + MAIL-SENDER-1 (18 sep): deze indeling.
