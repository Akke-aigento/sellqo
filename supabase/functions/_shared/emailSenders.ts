/**
 * Afzenders van alle mail die SellQo verstuurt (MAIL-SENDER-1, 18 sep 2026).
 *
 * Stream A — platform → gebruikers van een winkel. Altijd info@sellqo.app, het
 *   enige adres dat op de root sellqo.app (Migadu) bestaat. Het label staat in
 *   de weergavenaam ("SellQo Billing"), niet in het adres.
 * Stream B — winkel → klant. From "<winkelnaam> <<prefix>@mail.sellqo.app>"
 *   (Resend), Reply-To de klantcontact-e-mail van de winkel, anders haar
 *   SellQo-inbox. Eén bouwer voor alle soorten mail: de oude local parts per
 *   stroom (orders@, invoices@, …) bestaan niet meer.
 *
 * Auth-mail (auth-email-hook) loopt apart via Lovable Managed op auth.sellqo.app.
 * Zie docs/email-architecture.md.
 */

import { resolveCustomerContactEmail, tenantMailAddress, type CustomerContactSource } from "./customerContact.ts";

const PLATFORM_ADDRESS = "info@sellqo.app";

export const sanitizeName = (raw: string | null | undefined, fallback = "SellQo"): string => {
  const v = (raw || "").trim();
  if (!v) return fallback;
  // strip control chars + double-quotes that would break the From header
  return v.replace(/["<>\r\n]/g, "").slice(0, 80) || fallback;
};

export interface SenderConfig {
  from: string;
  replyTo?: string;
}

const platform = (label?: string): SenderConfig => ({
  from: `SellQo${label ? ` ${label}` : ""} <${PLATFORM_ADDRESS}>`,
  replyTo: PLATFORM_ADDRESS,
});

// ── Stream A — platform → gebruikers van een winkel ──────────────────
export const EMAIL_SENDERS = {
  invite: platform(),
  billing: platform("Billing"),
  notifications: platform(),
  security: platform("Security"),
  noReply: { from: `SellQo <${PLATFORM_ADDRESS}>`, replyTo: undefined } as SenderConfig,
} as const;

export type SenderKey = keyof typeof EMAIL_SENDERS;

// ── Stream B — winkel → klant ────────────────────────────────────────
export interface TenantSenderSource extends CustomerContactSource {
  name?: string | null;
}

/**
 * From = de winkel op haar eigen SellQo-adres, Reply-To = haar klantcontact.
 * Zonder geldige prefix is er geen winkeladres: dan gaat de mail als SellQo
 * via info@ de deur uit, en staat dat luid in de log — liever een herkenbare
 * noodval dan een mail die niet vertrekt.
 */
export function tenantSender(source: TenantSenderSource | null | undefined): SenderConfig {
  const address = tenantMailAddress(source);
  const replyTo = resolveCustomerContactEmail(source);
  if (!address) {
    console.error("[emailSenders] winkel zonder geldige mailprefix; From valt terug op SellQo <info@sellqo.app>", {
      name: source?.name ?? null,
      inbound_email_prefix: source?.inbound_email_prefix ?? null,
      slug: source?.slug ?? null,
    });
    return { from: `SellQo <${PLATFORM_ADDRESS}>`, replyTo };
  }
  return { from: `${sanitizeName(source?.name)} <${address}>`, replyTo };
}
