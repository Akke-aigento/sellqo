// MAIL-INBOUND-1 — welk winkeladres staat er in de To van een inkomende mail?
//
// Puur, geen imports: src/test/inboundAddress.test.ts laadt dit rechtstreeks.
//
// Inkomende mail voor winkels loopt via Resend op mail.sellqo.app
// (MX mail → inbound-smtp.eu-west-1.amazonaws.com). De root sellqo.app blijft
// bij Migadu; een adres op de root is dus nooit een winkeladres en levert
// null op. Tot 18 sep 2026 las deze functie alleen `<prefix>@sellqo.app` —
// precies het domein waar SellQo nooit mail ontving.

export const INBOUND_DOMAIN = "mail.sellqo.app";

/** Zelfde regel als een slug: kleine letters, cijfers en koppeltekens. */
export const MAIL_PREFIX_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * `"vanxcel@mail.sellqo.app"` of `"VanXcel <VanXcel@Mail.SellQo.app>"` →
 * `"vanxcel"`. Alles wat niet op mail.sellqo.app eindigt, of geen geldige
 * prefix heeft, geeft null.
 */
export function extractInboundPrefix(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const angled = /<([^<>]+)>/.exec(raw);
  const address = (angled ? angled[1] : raw).trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at <= 0) return null;
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  if (domain !== INBOUND_DOMAIN) return null;
  return MAIL_PREFIX_RE.test(local) ? local : null;
}

/** INKOOP-4 — het facturenadres van een winkel: `<prefix>+facturen@mail.sellqo.app`. */
export const INVOICE_INBOX_TAG = "facturen";

/**
 * Winkeladres mét optionele plus-tag: `"vanxcel+facturen@mail.sellqo.app"` →
 * `{ prefix: "vanxcel", tag: "facturen" }`; zonder tag `tag: null`. Zelfde regels
 * als extractInboundPrefix voor de prefix; de tag is kleine letters/cijfers.
 */
export function extractInboundAddress(raw: string | null | undefined): { prefix: string; tag: string | null } | null {
  if (!raw) return null;
  const angled = /<([^<>]+)>/.exec(raw);
  const address = (angled ? angled[1] : raw).trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at <= 0) return null;
  const local = address.slice(0, at);
  if (address.slice(at + 1) !== INBOUND_DOMAIN) return null;
  const plus = local.indexOf("+");
  const prefix = plus < 0 ? local : local.slice(0, plus);
  const tag = plus < 0 ? null : local.slice(plus + 1);
  if (!MAIL_PREFIX_RE.test(prefix)) return null;
  if (tag !== null && !/^[a-z0-9]{1,30}$/.test(tag)) return null;
  return { prefix, tag };
}

/** Het facturenadres van een winkel (voor de admin). */
export function invoiceInboxAddress(prefix: string): string {
  return `${prefix}+${INVOICE_INBOX_TAG}@${INBOUND_DOMAIN}`;
}
