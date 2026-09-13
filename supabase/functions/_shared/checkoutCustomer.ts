// CHECKOUT-CUST-1 — `customer_id` uit een checkoutverzoek niet blind vertrouwen.
//
// create-checkout-session en create-bank-transfer-order zijn publiek (geen JWT)
// en zetten `customer_id` uit de body op de bestelling. Wie een klant-id kende,
// kon zo een bestelling aan iemand anders hangen — ook aan een klant van een
// andere winkel. Er lekte geen data, maar de bestelhistoriek en klantstatistiek
// van die klant raakten vervuild. Nagetrokken 13 sep 2026: nooit gebeurd.
//
// Een id telt alleen als de klant bij deze winkel hoort én hetzelfde e-mailadres
// heeft als de bestelling. Anders wordt hij weggelaten, en gaat de bestelling
// gewoon door zonder koppeling: een checkout mag hier nooit op mislukken.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

export function customerMatchesOrder(
  customer: { tenant_id: string; email: string | null } | null,
  tenantId: string,
  orderEmail: string,
): boolean {
  if (!customer || customer.tenant_id !== tenantId || !customer.email) return false;
  return customer.email.trim().toLowerCase() === orderEmail.trim().toLowerCase();
}

export async function verifiedCustomerId(
  client: SupabaseClient,
  customerId: string | null | undefined,
  tenantId: string,
  orderEmail: string,
): Promise<string | null> {
  if (!customerId) return null;
  const { data, error } = await client
    .from('customers')
    .select('tenant_id, email')
    .eq('id', customerId)
    .maybeSingle();
  if (error) {
    console.warn('[checkoutCustomer] lookup failed, order continues without customer_id:', error.message);
    return null;
  }
  if (!customerMatchesOrder(data, tenantId, orderEmail)) {
    console.warn('[checkoutCustomer] customer_id does not belong to this tenant/email, ignored');
    return null;
  }
  return customerId;
}
