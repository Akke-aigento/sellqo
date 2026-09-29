// INBOX-REPLY-1 — serverkant: een `customer_id` uit de body pas wegschrijven als
// het een uuid is én de klant bij deze winkel hoort. De verzendfuncties draaien
// op de service-role, dus zonder deze check kon een id uit een andere winkel
// gewoon gekoppeld worden. Bij twijfel: null met een waarschuwing, geen 500 —
// het bericht zelf is belangrijker dan de koppeling.

import { realCustomerId } from "./customerId.ts";

// deno-lint-ignore no-explicit-any
export async function ownedCustomerIdOrNull(supabase: any, tenantId: string, value: unknown, fn: string): Promise<string | null> {
  if (value === undefined || value === null || value === "") return null;
  const id = realCustomerId(value);
  if (!id) {
    console.warn(`[${fn}] customer_id genegeerd: geen uuid`);
    return null;
  }
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) {
    console.warn(`[${fn}] customer_id genegeerd: controle mislukt (${error.message})`);
    return null;
  }
  if (!data) {
    console.warn(`[${fn}] customer_id genegeerd: hoort niet bij deze winkel`);
    return null;
  }
  return id;
}
