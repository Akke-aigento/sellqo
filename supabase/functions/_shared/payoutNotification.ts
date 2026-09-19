// NOTIF-SOURCES-1 — één pad voor payout-meldingen, gedeeld door
// platform-stripe-webhook en stripe-connect-webhook.
//
// Tot 19 sep 2026 had elke webhook een eigen helper. stripe-connect riep de RPC
// send_notification aan met `p_data` — die parameter bestaat niet (`p_metadata`),
// dus elke aanroep faalde stil: 0 payout-meldingen ooit. platform-stripe-webhook
// ging wel via create-notification. Beide verwerken payout.created/paid/failed/
// canceled; welke van de twee Stripe aflevert is niet vast te stellen. Daarom:
// één helper, dedup op type + payout_id, en een unieke index
// (notifications_payout_once) voor de race tussen de twee.

export interface PayoutNotificationArgs {
  stripeAccountId: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  data: Record<string, unknown> & { payout_id?: string };
}

/** Het deel van de supabase-client dat deze helper gebruikt. Los getypeerd (TS2589). */
export interface PayoutClient {
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
  functions: {
    // deno-lint-ignore no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoke(name: string, options: { body: Record<string, unknown> }): Promise<any>;
  };
}

/** De body voor create-notification — snake_case, zoals hij hem leest. */
export function payoutNotificationBody(tenantId: string, args: PayoutNotificationArgs): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    category: "payments",
    type: args.type,
    title: args.title,
    message: args.message,
    priority: args.priority,
    action_url: "/admin/payments",
    data: args.data,
  };
}

async function findTenantId(client: PayoutClient, stripeAccountId: string): Promise<string | null> {
  if (!stripeAccountId) return null;
  // Connect-merchant eerst; dan de platform-klant (zoals platform-stripe-webhook deed).
  const { data: connect } = await client
    .from("tenants").select("id").eq("stripe_account_id", stripeAccountId).maybeSingle();
  if (connect?.id) return connect.id as string;
  const { data: sub } = await client
    .from("tenant_subscriptions").select("tenant_id").eq("stripe_customer_id", stripeAccountId).maybeSingle();
  return (sub?.tenant_id as string | undefined) ?? null;
}

export type PayoutNotifyResult = "sent" | "duplicate" | "no_tenant";

export async function notifyPayout(client: PayoutClient, args: PayoutNotificationArgs): Promise<PayoutNotifyResult> {
  const tenantId = await findTenantId(client, args.stripeAccountId);
  if (!tenantId) return "no_tenant";

  const payoutId = args.data.payout_id;
  if (payoutId) {
    const { data: existing } = await client
      .from("notifications")
      .select("id")
      .eq("type", args.type)
      .eq("data->>payout_id", payoutId)
      .limit(1)
      .maybeSingle();
    if (existing) return "duplicate";
  }

  // Een gelijktijdige tweede aanroep botst op notifications_payout_once;
  // create-notification antwoordt dan { duplicate: true } (23505).
  await client.functions.invoke("create-notification", { body: payoutNotificationBody(tenantId, args) });
  return "sent";
}
