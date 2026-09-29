// INBOX-REPLY-1 — is dit een echte klant-id, of een afgeleide sleutel?
//
// De inbox groepeert berichten zonder klant op `e-mail::onderwerp` en gaf die
// sleutel tot 29-09 door als `customer.id`. Die belandde bij een antwoord in de
// uuid-kolom `customer_messages.customer_id` → "invalid input syntax for type
// uuid" en geen antwoord. Alles wat een klant-id naar de database of naar
// /admin/customers/:id stuurt, gaat door deze check.
//
// Puur en zonder imports: gedeeld met src/ en getest door vitest.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** De id als het een echte uuid is, anders null. */
export function realCustomerId(value: unknown): string | null {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}
