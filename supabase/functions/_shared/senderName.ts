/**
 * MAIL-REPLY-FORMAT-1 — welke naam tonen of meesturen voor een afzender.
 * UNIFIED-MAIL-1: verhuisd van src/lib naar _shared, zodat ook de meldingsmail
 * (create-notification) dezelfde keuze maakt. Puur, geen imports.
 *
 * Volgorde: klantnaam → `context_data.name` (contactformulier) → weergavenaam
 * uit de From-header (`Cissy Janssen <cissy@x.nl>`, zo slaat handle-inbound-email
 * `from_email` op) → het kale e-mailadres. Tot 29-09 viel de inbox bij een
 * afzender zonder klant meteen terug op het adres, ook als er een naam was.
 */

export interface ParsedFrom {
  name: string | null;
  address: string;
}

/** `"Naam" <a@b.nl>`, `Naam <a@b.nl>`, `<a@b.nl>` of `a@b.nl` → naam + kaal adres. */
export function parseFromHeader(raw: string | null | undefined): ParsedFrom {
  const value = (raw ?? '').trim();
  const match = value.match(/^(.*?)\s*<([^<>\s]+)>\s*$/);
  if (!match) return { name: null, address: value };
  const name = match[1].trim().replace(/^"(.*)"$/, '$1').trim();
  return { name: name || null, address: match[2].trim() };
}

const clean = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

export function resolveSenderName(input: {
  customerName?: string | null;
  contextName?: unknown;
  from?: string | null;
  /** Adres als er geen naam is; standaard het adres uit `from`. */
  fallback?: string | null;
}): string {
  const from = parseFromHeader(input.from);
  const fallback = clean(input.fallback) ?? from.address;
  const addresses = new Set([from.address.toLowerCase(), fallback.toLowerCase()]);
  // Een "naam" die gewoon een adres is, telt niet als naam.
  const isName = (v: string | null): v is string => !!v && !addresses.has(v.toLowerCase());

  const customerName = clean(input.customerName);
  if (isName(customerName)) return customerName;
  const contextName = clean(input.contextName);
  if (isName(contextName)) return contextName;
  if (isName(from.name)) return from.name;
  return fallback;
}
