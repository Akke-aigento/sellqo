// APP-INBOX-CRASH-1 — inbound e-mail is idempotent op Resend's email_id.
//
// Resend herhaalt een webhook als hij geen 2xx ziet (of zomaar, bij een
// replay). Op 18 sep 2026 stonden daardoor twee rijen "Test 3 inbound" met
// dezelfde resend_id, elk met een eigen melding. Nu: bestaat er al een
// inbound-rij met die resend_id, dan antwoordt handle-inbound-email met
// { duplicate: true } en schrijft niets. De unieke partiële index
// customer_messages_inbound_resend_id_key vangt de race van twee gelijktijdige
// aanroepen; die insert-fout (23505) telt ook als duplicaat.
//
// Puur en zonder imports, zodat vitest hem kan testen met een nep-client.

/**
 * Het deel van de supabase-client dat deze check gebruikt. Bewust los
 * getypeerd: het volledige builder-type van supabase-js laat deno check
 * vastlopen op TS2589 (te diepe instantiatie).
 */
export interface InboundLookupClient {
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

/**
 * Id van een bestaande inbound-rij met deze resend_id, of null.
 * Faalt de lookup, dan null: liever een zeldzame dubbele rij dan een gemiste
 * klantmail.
 */
export async function findExistingInbound(
  client: InboundLookupClient,
  emailId: string | null | undefined,
): Promise<string | null> {
  if (!emailId) return null;
  const { data, error }: { data: { id: string } | null; error: unknown } = await client
    .from("customer_messages")
    .select("id")
    .eq("direction", "inbound")
    .eq("resend_id", emailId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("Inbound duplicate lookup failed, processing anyway:", error);
    return null;
  }
  return data?.id ?? null;
}

/** Postgres unique_violation — hier: de partiële index op resend_id. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}
