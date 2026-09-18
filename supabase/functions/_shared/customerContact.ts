// MAIL-CONTACT-1 — het ene adres dat klanten van een winkel zien.
//
// Reply-To, footer en mailto van elke mail van een winkel aan haar klanten
// (Stream B, zie docs/email-architecture.md). Tot 18 sep 2026 bouwde elke
// functie haar eigen keten, en lekte `notification_email` — het adres voor de
// eigen meldingen van de winkel — via tenantEmail.ts naar klanten. Nu is
// `support_email` de enige bron; de winkel stelt het in bij Instellingen.
//
// Puur: geen imports, zodat src/test/customerContact.test.ts dit bestand
// rechtstreeks laadt.

export interface CustomerContactSource {
  support_email?: string | null;
  owner_email?: string | null;
}

// Tijdelijk: in MAIL-SENDER-1 wordt de fallback <prefix>@mail.sellqo.app.
const PLATFORM_FALLBACK = "info@sellqo.app";

function clean(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v ? v : null;
}

export function resolveCustomerContactEmail(
  tenant: CustomerContactSource | null | undefined,
): string {
  return clean(tenant?.support_email) ?? clean(tenant?.owner_email) ?? PLATFORM_FALLBACK;
}
