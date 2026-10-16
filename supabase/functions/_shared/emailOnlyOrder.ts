// EVENT-ORDER-1 — wanneer is een bestelling "alleen per mail geleverd"?
//
// Puur, zonder Deno- of Supabase-afhankelijkheden: de edge function
// update-order-fulfillment-status (de poort) en de admin-frontend
// (src/lib/orderTransitions.ts, de spiegel) gebruiken exact deze code.
//
// Een regel telt als e-mailregel als hij aan een event hangt (event_detail_id),
// of als zijn product een ticket is (ook combitickets: product_type 'ticket'
// met ticket_bundle_items) of een muntenpakket (token_amount gezet). Dezelfde
// productregel als de auto-delivered-stap in send-ticket-confirmation
// (r.~404-420). Een regel zonder event en zonder (gevonden) product is
// onbekend en telt dus als fysiek: zulke orders blijven in de gewone flow.

export interface EmailOnlyLine {
  product_id: string | null;
  event_detail_id?: string | null;
}

export interface EmailOnlyProduct {
  id: string;
  product_type: string | null;
  token_amount: number | null;
}

export function isEmailOnlyOrder(
  lines: readonly EmailOnlyLine[],
  products: readonly EmailOnlyProduct[],
): boolean {
  if (lines.length === 0) return false;
  const byId = new Map(products.map((p) => [p.id, p]));
  return lines.every((l) => {
    if (l.event_detail_id) return true;
    if (!l.product_id) return false;
    const p = byId.get(l.product_id);
    if (!p) return false;
    return p.product_type === "ticket" || p.token_amount != null;
  });
}

/**
 * Extra overgangen bovenop de gewone matrix, alleen voor e-mail-orders.
 * Een ticketbestelling springt na de ticketmail meteen naar `delivered`;
 * zonder deze uitzondering kon ze enkel via "Status corrigeren" geannuleerd
 * worden. Fysieke bestellingen krijgen deze overgang nooit.
 */
export const EMAIL_ONLY_EXTRA_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  delivered: ["cancelled"],
};

export function emailOnlyAllows(from: string, to: string): boolean {
  return (EMAIL_ONLY_EXTRA_TRANSITIONS[from] ?? []).includes(to);
}
