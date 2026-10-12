// AI-CRED-1 (12-10-2026) — een betaalde AI-credits-checkout toekennen.
//
// create-ai-credits-checkout maakte een Stripe-sessie met metadata
// { type: 'ai_credits', purchase_id, tenant_id, credits }, maar geen enkele
// webhook deed er iets mee: platform-stripe-webhook logde checkout.session.completed
// en stopte. Een klant betaalde dus en kreeg niets. Deze module sluit dat gat.
//
// Idempotent: de aankoop gaat van 'pending' naar 'completed' met een conditionele
// update; alleen wie die overgang wint, kent credits toe. Een herhaalde webhook
// (Stripe stuurt events soms dubbel) verandert dus niets.
//
// Geen imports: de beslissing is puur en getest (src/test/aiCreditPurchase.test.ts).

export interface CheckoutSessionLike {
  id: string;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_intent?: string | { id: string } | null;
  metadata?: Record<string, string> | null;
}

export type AiCreditDecision =
  | { kind: "not_ai_credits" }
  | { kind: "not_paid" }
  | { kind: "invalid"; reason: string }
  | { kind: "grant"; purchaseId: string; tenantId: string; credits: number; paymentIntentId: string | null; amount: number; currency: string };

export function decideAiCreditGrant(session: CheckoutSessionLike): AiCreditDecision {
  const meta = session.metadata ?? {};
  if (meta.type !== "ai_credits") return { kind: "not_ai_credits" };
  // Bancontact/iDEAL zijn meestal meteen 'paid'; een uitgestelde betaling komt
  // later als checkout.session.async_payment_succeeded en gaat dan opnieuw hierdoor.
  if (session.payment_status !== "paid") return { kind: "not_paid" };

  const purchaseId = meta.purchase_id;
  const tenantId = meta.tenant_id;
  const credits = Number(meta.credits);
  if (!purchaseId || !tenantId) return { kind: "invalid", reason: "missing purchase_id or tenant_id" };
  if (!Number.isInteger(credits) || credits <= 0) return { kind: "invalid", reason: "invalid credits" };

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  return {
    kind: "grant",
    purchaseId,
    tenantId,
    credits,
    paymentIntentId,
    amount: Math.round(Number(session.amount_total ?? 0)) / 100,
    currency: (session.currency ?? "eur").toUpperCase(),
  };
}

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type AiCreditGrantResult =
  | "skipped"
  | "already_completed"
  | "granted"
  | { error: string };

/**
 * Kent een betaalde aankoop toe. Gooit nooit: de webhook moet altijd 200 geven,
 * anders blijft Stripe opnieuw proberen. Fouten komen terug als { error }.
 */
export async function grantAiCreditPurchase(
  supabase: Db,
  session: CheckoutSessionLike,
  log: (step: string, details?: unknown) => void = () => {},
): Promise<AiCreditGrantResult> {
  const decision = decideAiCreditGrant(session);
  if (decision.kind !== "grant") {
    if (decision.kind === "invalid") log("AI credits: ongeldige sessie", { session: session.id, reason: decision.reason });
    return "skipped";
  }

  try {
    // 1. Claim de aankoop. Alleen de eerste webhook krijgt een rij terug.
    const { data: claimed, error: claimErr } = await supabase
      .from("ai_credit_purchases")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        stripe_session_id: session.id,
        stripe_payment_intent_id: decision.paymentIntentId,
      })
      .eq("id", decision.purchaseId)
      .eq("tenant_id", decision.tenantId)
      .eq("status", "pending")
      .select("id, credits_amount");
    if (claimErr) throw claimErr;
    if (!claimed || claimed.length === 0) {
      log("AI credits: al verwerkt of onbekend", { purchase: decision.purchaseId });
      return "already_completed";
    }

    // De database is de bron voor het aantal, niet de metadata.
    const credits = Number(claimed[0].credits_amount ?? decision.credits);

    // 2. Credits erbij. Zonder auth.uid() (service role) laat add_ai_credits dit toe.
    const { error: addErr } = await supabase.rpc("add_ai_credits", {
      p_tenant_id: decision.tenantId,
      p_credits: credits,
    });
    if (addErr) {
      // Terugdraaien naar pending, zodat een volgende webhook-poging het opnieuw probeert.
      await supabase.from("ai_credit_purchases").update({ status: "pending", completed_at: null })
        .eq("id", decision.purchaseId);
      throw addErr;
    }

    // 3. Betaalbewijs, zoals confirm-platform-bank-payment dat voor de overschrijving doet.
    const now = new Date().toISOString();
    const { error: invErr } = await supabase.from("platform_invoices").insert({
      tenant_id: decision.tenantId,
      amount: decision.amount,
      currency: decision.currency,
      status: "paid",
      payment_method: "stripe",
      payment_type: "ai_credits",
      paid_at: now,
      invoice_date: now,
    });
    if (invErr) log("AI credits: betaalbewijs mislukt (niet fataal)", { error: invErr.message });

    log("AI credits toegekend", { tenant: decision.tenantId, credits });
    return "granted";
  } catch (e) {
    const message = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    log("AI credits: toekennen mislukt", { session: session.id, error: message });
    return { error: message };
  }
}
