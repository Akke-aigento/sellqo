// MAIL-CONTACT-1 / MAIL-SENDER-1 — de adressen van een winkel naar haar klanten.
//
// Reply-To, footer en mailto van elke mail van een winkel aan haar klanten
// (Stream B, zie docs/email-architecture.md). `support_email` stelt de winkel
// zelf in; laat ze het leeg, dan is het antwoordadres haar eigen SellQo-inbox
// <prefix>@mail.sellqo.app — antwoorden komen dan in de inbox in de admin.
// `owner_email` en `notification_email` horen hier niet in.
//
// Puur: importeert alleen inboundAddress.ts, zodat de tests dit rechtstreeks laden.

import { INBOUND_DOMAIN, MAIL_PREFIX_RE } from "./inboundAddress.ts";

export interface CustomerContactSource {
  support_email?: string | null;
  inbound_email_prefix?: string | null;
  slug?: string | null;
}

/** Laatste redmiddel als een winkel geen geldige prefix heeft. Wordt gelogd. */
export const PLATFORM_CONTACT = "info@sellqo.app";

function clean(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v ? v : null;
}

/** `inbound_email_prefix`, anders de slug — alleen als die een geldig local part is. */
export function resolveTenantMailPrefix(tenant: CustomerContactSource | null | undefined): string | null {
  for (const candidate of [tenant?.inbound_email_prefix, tenant?.slug]) {
    const v = clean(candidate)?.toLowerCase();
    if (v && MAIL_PREFIX_RE.test(v)) return v;
  }
  return null;
}

/** `<prefix>@mail.sellqo.app`, of null zonder geldige prefix. */
export function tenantMailAddress(tenant: CustomerContactSource | null | undefined): string | null {
  const prefix = resolveTenantMailPrefix(tenant);
  return prefix ? `${prefix}@${INBOUND_DOMAIN}` : null;
}

export function resolveCustomerContactEmail(tenant: CustomerContactSource | null | undefined): string {
  const own = clean(tenant?.support_email);
  if (own) return own;
  const inbox = tenantMailAddress(tenant);
  if (inbox) return inbox;
  console.error("[customerContact] winkel zonder geldige mailprefix; antwoordadres valt terug op", PLATFORM_CONTACT, {
    inbound_email_prefix: tenant?.inbound_email_prefix ?? null,
    slug: tenant?.slug ?? null,
  });
  return PLATFORM_CONTACT;
}
