# Email Architecture — Sender Address Strategy

_Last updated: 2026-06-09_

## Overview

SellQo verstuurt e-mails vanuit **één geverifieerd domein** (`sellqo.app`, verified in Resend) maar gebruikt **14 dedicated mailboxes** om verschillende e-mailstreams te scheiden. Dit verbetert:

- **Deliverability** — banks/Gmail/Outlook reputation per address
- **Inbox-organisatie** voor klanten (bestellingen vs. facturen vs. marketing)
- **Reply-routing** — alle replies komen op `support@sellqo.app` tenzij tenant een eigen support-email heeft
- **Threading & filtering** — klanten kunnen filters bouwen

Geen DNS-werk nodig: `sellqo.app` is al volledig geverifieerd.

## Stream A — Platform → Tenant-users (NL)

Communicatie van het SellQo-platform naar admins/team-leden van een tenant. Body is altijd in het Nederlands.

| Address                       | Sender-key      | Edge functions                                |
| ----------------------------- | --------------- | --------------------------------------------- |
| `invite@sellqo.app`           | `invite`        | `send-team-invitation`, `resend-team-invitation` |
| `billing@sellqo.app`          | `billing`       | `send-trial-expiry-warning` (+ toekomstige facturatie-emails platform) |
| `notifications@sellqo.app`    | `notifications` | `create-notification` (email-kanaal)         |
| `security@sellqo.app`         | `security`      | _(backlog: password-reset / suspicious-login)_ |
| `no-reply@sellqo.app`         | `noReply`       | _(fallback voor system-emails zonder reply)_  |

`reply_to` voor alle Stream A → `support@sellqo.app`.

## Stream B — Tenant → Customers (EN sender, body lokaal)

Communicatie van een tenant naar diens klanten. **Sender-naam = tenantnaam**, address blijft op `sellqo.app`. Body-taal komt uit `tenant_domains.locale` of order/customer locale.

| Address                          | Sender-key        | Edge functions                          |
| -------------------------------- | ----------------- | --------------------------------------- |
| `orders@sellqo.app`              | `orders`          | `send-order-confirmation`               |
| `invoices@sellqo.app`            | `invoices`        | `send-invoice-email`, `send-credit-note-email` |
| `quotes@sellqo.app`              | `quotes`          | `send-quote-email`                      |
| `returns@sellqo.app`             | `returns`         | `send-return-email`                     |
| `gift-cards@sellqo.app`          | `giftCards`       | `send-gift-card-email`                  |
| `marketing@sellqo.app`           | `marketing`       | `send-campaign-batch`, `automation-scheduler` |
| `customer-service@sellqo.app`    | `customerService` | `send-customer-message`                 |

`reply_to` voor Stream B → `tenant.support_email || tenant.owner_email || support@sellqo.app`.

## Inbound

`inbox@sellqo.app` blijft de inbound-route die door `storefront-api` / `storefront-customer-api` wordt verwerkt voor klant-replies. Niet gewijzigd.

## Body-taal vs Sender-taal

- **Sender-address blijft EN/neutraal** (`orders@`, `invoices@`, etc.) — internationaal herkenbaar en stabiel.
- **Sender-naam = tenant.name** — branding zichtbaar in inbox-preview.
- **Body-taal** wordt per e-mail bepaald via `tenant_domains.locale` (storefront-emails) of `customer.locale`/order-locale (admin-emails). Geen wijziging in deze batch.

## Implementatie

Alle sender-config gecentraliseerd in `supabase/functions/_shared/emailSenders.ts`:

```ts
import { EMAIL_SENDERS } from "../_shared/emailSenders.ts";

// Stream A
const inv = EMAIL_SENDERS.invite; // { from, replyTo }

// Stream B
const orderSender = EMAIL_SENDERS.orders(tenant.name, tenant.support_email);
```

`tenantName` wordt automatisch gesanitized (geen `<>`, `"`, controlechars, max 80 tekens). Lege of ontbrekende `tenantReplyTo` valt terug op `support@sellqo.app`.

## Resend domain status

- `sellqo.app` — **verified** (alle 14 mailboxes gebruiken dit domain via verschillende local-parts; geen aparte verificatie per mailbox vereist binnen Resend).

## Backlog

- **Per-tenant verified domains**: bv. `orders@vanxcel.com`. Vereist:
  - Resend `domains.create` per tenant
  - DNS-records (SPF/DKIM/MX of return-path) in domein van tenant
  - UI in `tenant_email_branding` voor "Bring Your Own Domain"
  - Fallback naar `sellqo.app` als tenant-domain `unverified`/`failed`
- **Per-stream open-rate / bounce tracking** per address (Resend Analytics + `email_send_log`).
- **DMARC report parsing** om reputation per address te monitoren.
- **`security@`-flow**: implementatie van password-reset & suspicious-login wanneer auth-hardening op de roadmap komt.