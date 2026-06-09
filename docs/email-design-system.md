# Email Design System

_Last updated: 2026-06-09_

SellQo emails worden gebouwd met een gedeelde set building blocks in
`supabase/functions/_shared/sellqoEmail.ts`. Doel: één bron-van-waarheid
voor branding, dark-mode, en cross-client rendering (Gmail, Apple Mail,
Outlook, mobiele clients).

## Architecture

| Stream                          | Doel                              | Visual identity            |
| ------------------------------- | --------------------------------- | -------------------------- |
| **A — Platform → Tenant-users** | Invites, billing, notificaties    | SellQo-branded (NL)        |
| **B — Tenant → Customers**      | Orders, invoices, returns, etc.   | Tenant-branded, sellqo-app body in tenant-locale |

Sender-mapping: zie `docs/email-architecture.md`.

## Building blocks

Alle helpers zijn pure functies die HTML-strings teruggeven.

| Helper                | Doel                                                       |
| --------------------- | ---------------------------------------------------------- |
| `emailHeader`         | Header met logo + optionele tenantnaam                     |
| `emailFooter`         | Legal, support-link, unsubscribe, extra links              |
| `emailButton`         | Bulletproof MSO + non-MSO knop (`primary` / `secondary`)   |
| `emailInfoBox`        | Highlighted box met `info`/`success`/`warning`/`danger`    |
| `emailDivider`        | Horizontale lijn                                           |
| `emailTable`          | Line-items voor orders/invoices, met optionele footer-rij  |
| `emailAddressBlock`   | Shipping/billing-address                                   |
| `emailHeading`        | Consistente H1/H2/H3                                       |
| `emailParagraph`      | Standaard paragraph (`muted` variant + `raw` HTML mode)    |
| `emailBaseLayout`     | Wraps content in full HTML + dark-mode media query         |
| `renderSellqoEmail`   | Convenience: SellQo-defaults bovenop `emailBaseLayout`     |

## Color tokens (BRAND)

```ts
BRAND = {
  primary:    "#1d3a5f",
  primaryDark:"#142a45",
  accent:     "#ff7733",
  text:       "#1a2332",
  muted:      "#5b6b7d",
  border:     "#e4e8ee",
  bg:         "#f4f6f9",
  card:       "#ffffff",
  footerText: "#8a96a4",
}
```

InfoBox-variants:

| Variant   | Background | Border    | Accent    |
| --------- | ---------- | --------- | --------- |
| `info`    | `#f7f9fc`  | `#e4e8ee` | `#ff7733` |
| `success` | `#ecfdf5`  | `#a7f3d0` | `#10b981` |
| `warning` | `#fffbeb`  | `#fde68a` | `#f59e0b` |
| `danger`  | `#fef2f2`  | `#fecaca` | `#ef4444` |

## Dark-mode strategie

`emailBaseLayout` injecteert standaard een `<style>`-blok met
`@media (prefers-color-scheme: dark)` overrides die `.sq-bg`, `.sq-card`,
`.sq-footer`, `.sq-muted`, en `.sq-divider` retargeten naar donkere
kleuren. Light-mode tokens blijven inline (Outlook negeert media queries
— die zien light-mode). Klanten met dark-mode (Apple Mail, iOS, Gmail
Android) krijgen automatisch een donkere variant zonder dubbele templates.

Disable via `darkMode: false` in `emailBaseLayout` of `renderSellqoEmail`
wanneer een tenant uitdrukkelijk light-only branding wil.

## Plain-text fallback

Roep altijd `htmlToPlainText(html)` aan en geef de output mee als
`text:`-parameter aan `resend.emails.send()`. Verbetert deliverability en
toegankelijkheid (text-only clients, screenreaders).

## Developer guide — nieuwe email

```ts
import {
  renderSellqoEmail,
  htmlToPlainText,
  emailTable,
  emailAddressBlock,
} from "../_shared/sellqoEmail.ts";
import { EMAIL_SENDERS } from "../_shared/emailSenders.ts";

const itemsTable = emailTable({
  headers: ["Product", "Aantal", "Prijs"],
  rows: order.items.map(i => [i.name, String(i.qty), formatCurrency(i.total)]),
  footer: { label: "Totaal", value: formatCurrency(order.total) },
});

const html = renderSellqoEmail({
  preheader: `Bedankt voor je bestelling #${order.number}`,
  heading: `Bedankt voor je bestelling`,
  intro: `<p>Hi ${customer.firstName},</p><p>We hebben je bestelling ontvangen.</p>${itemsTable}`,
  infoBox: { title: "📦 Verzending", subtitle: "We sturen je een mail zodra je pakket onderweg is.", variant: "success" },
  cta: { label: "Bekijk bestelling", url: orderUrl },
  supportEmail: tenant.support_email,
});

const sender = EMAIL_SENDERS.orders(tenant.name, tenant.support_email);
await resend.emails.send({
  from: sender.from,
  reply_to: sender.replyTo,
  to: [customer.email],
  subject: `Bestelling #${order.number}`,
  html,
  text: htmlToPlainText(html),
});
```

### Regels

1. **Nooit** een eigen `<html>`-skelet bouwen — gebruik `emailBaseLayout`
   of `renderSellqoEmail`.
2. **Nooit** hardcoded `noreply@sellqo.app` — altijd via `EMAIL_SENDERS`.
3. **Altijd** plain-text fallback meesturen.
4. **Escape user-content** zelf wanneer je het in `intro` (raw HTML) zet.
   Building blocks die plain text accepteren (`emailHeading`,
   `emailParagraph` zonder `raw`, `emailInfoBox`, `emailButton`,
   `emailAddressBlock`) escapen intern.
5. **`infoBox.variant`** kiezen op basis van toon:
   `success` (positieve bevestiging), `warning` (actie nodig),
   `danger` (urgent/fout), `info` (neutrale toelichting).

## Backlog

- Per-tenant color-overrides (brand.primary uit `tenant_email_branding`)
- Litmus / Email-on-Acid cross-client snapshots in CI
- React-Email migratie wanneer Lovable cloud-side scaffolding klaar is
- Per-stream A/B-templates voor open-rate optimalisatie

---

## Stream B — Tenant → Customer (EMAIL-2)

`_shared/tenantEmail.ts` is de parallel-util voor customer-facing emails.
Erft het skelet (`emailBaseLayout`, dark-mode CSS, plain-text fallback) van
`_shared/sellqoEmail.ts`, maar injecteert per-tenant branding uit
`tenants` + `tenant_theme_settings`.

### getTenantBrand()

```ts
const brand = await getTenantBrand(supabase, tenantId);
// → { tenantName, logoUrl, primaryColor, accentColor, themeMode,
//     headingFont, bodyFont, supportEmail, defaultLocale, ... }
```

Fallback-strategie (graceful degradation):

| Veld              | Bron (in volgorde)                                              | Fallback                |
| ----------------- | --------------------------------------------------------------- | ----------------------- |
| `tenantName`      | `tenants.name`                                                  | `"SellQo"`              |
| `logoUrl`         | `theme.logo_url` → `tenants.logo_url`                           | `LOGO_URL` (SellQo)     |
| `primaryColor`    | `theme.primary_color` → `tenants.primary_color`                 | `BRAND.primary`         |
| `themeMode`       | `theme.theme_mode`                                              | `"light"`               |
| `headingFont`     | `theme.heading_font`                                            | `"Inter"`               |
| `supportEmail`    | `tenants.support_email` → `contact_email` → `owner_email`       | `support@sellqo.app`    |
| `defaultLocale`   | `tenants.language` (sanitized)                                  | `"nl"`                  |

Malformed hex (bv. `red`, `#zzz`) wordt door `sanitizeColor()` teruggebracht
naar de SellQo default — voorkomt gebroken CTA-knoppen.

### renderTenantEmail()

```ts
const { html, text } = renderTenantEmail({
  tenantBrand: brand,
  locale,                            // 'nl' | 'en' | 'fr' | 'de'
  preheader: t(locale, 'order.thanks'),
  heading: t(locale, 'order.heading'),
  intro: `<p>${t(locale, 'order.intro', { customerName })}</p>`,
  content,                           // template-specific building blocks
  primaryCta: { label, url },
  secondaryCta: { label, url },
  unsubscribeUrl,                    // VERPLICHT voor marketing
  showSellqoFooter: true,            // "Powered by SellQo" — default ON
  poweredByLabel: t(locale, 'order.poweredBy'),
});
```

### Template-specific helpers

- `renderOrderLineItems(items, currency, locale, quantityLabel)`
- `renderInvoiceLineItems(lines, currency, locale, headers?)`
- `renderQuoteLineItems(lines, currency, locale, headers?)` (alias)
- `renderAddressBlocks({ shipping, billing, shippingLabel, billingLabel })`
- `renderTotalsBreakdown({ subtotal, shipping, tax, discount, total, currency, locale, labels, accentColor })`
- `renderPaymentInstructions({ iban, bic?, reference, amount, currency, locale, beneficiary? })`
- `renderTrackingInfo({ carrier, trackingNumber, trackingUrl? })`
- `renderGiftCardVisual({ code, amount, currency, locale, expiresAt?, brandColor? })`

Allemaal pure functies; ze geven een HTML-string terug die je in de
`content` parameter van `renderTenantEmail()` doorgeeft.

### i18n

`_shared/tenantEmailI18n.ts` definieert hard-coded strings voor 4 locales
(NL/EN/FR/DE) × 8 templates (order/invoice/creditNote/return/giftCard/
quote/message/campaign).

```ts
import { t } from '../_shared/tenantEmailI18n.ts';
t('nl', 'order.heading');                       // → "Bedankt voor je bestelling!"
t('en', 'order.subject', { orderNumber: 'A12' }); // → "Thank you for your order — A12"
```

Onbekende locale → automatisch fallback naar `en`. Onbekend pad → returneert
het pad zelf (zichtbaar tijdens dev).

**Nieuwe locale toevoegen:**
1. Copy een complete locale-block in `tenantEmailI18n.ts`.
2. Vertaal alle waarden (variabel-tokens `{customerName}` etc. ongewijzigd
   laten).
3. Voeg de code toe aan `SUPPORTED_LOCALES` in `tenantEmail.ts`.
4. Re-deploy de edge functions.

### Locale-resolution

```ts
const locale = await resolveEmailLocale(supabase, {
  explicit: order.locale,            // hoogste prioriteit
  customerLocale: customer?.locale,  // dan customer
  tenantId,
  countryCode: order.shipping_address?.country, // dan land-heuristic
  tenantDefault: brand.defaultLocale,           // dan tenant default
});
// Volgorde: explicit > customer > single-tenant-domain > country → en
```

### Refactored functies (EMAIL-2)

| Functie                       | Helper(s) gebruikt                                              |
| ----------------------------- | --------------------------------------------------------------- |
| `send-order-confirmation`     | renderOrderLineItems + renderAddressBlocks + renderTotalsBreakdown |
| `send-invoice-email`          | summary-block + renderTenantEmail (PDF blijft attached)         |
| `send-credit-note-email`      | renderTenantEmail + custom summary div                          |
| `send-quote-email`            | renderTenantEmail + bestaande VAT-logic                         |
| `send-return-email`           | renderTenantEmail + bestaande event-bodies (4 templates)        |
| `send-gift-card-email`        | renderGiftCardVisual                                            |
| `send-customer-message`       | renderTenantEmail (conversational toon)                         |
| `send-campaign-batch`         | renderTenantEmail + verplicht `unsubscribeUrl` + List-Unsubscribe header |

### Edge cases (gehandeld)

- **Geen `tenant_theme_settings` row** → enkel `tenants` velden + defaults
- **`logo_url` NULL of niet-http** → SellQo logo (`https://sellqo.app/email-logo.png`)
- **Malformed hex** (`red`, `#zzz`, leeg) → `BRAND.primary` (`#1d3a5f`)
- **Onbekende locale** → fallback `en`
- **Geen `customer.locale`** → tenant default → land-heuristic → `en`
- **Marketing zonder `unsubscribeUrl`** → footer toont géén unsubscribe (caller
  moet dit zetten — verplicht door anti-spam wet voor `send-campaign-batch`)

### Powered by SellQo

Default `showSellqoFooter: true` toont kleine muted-tekst onder tenant-footer.
Backlog: `tenant_theme_settings.show_sellqo_branding` kolom om enterprise-
tenants opt-out te geven.