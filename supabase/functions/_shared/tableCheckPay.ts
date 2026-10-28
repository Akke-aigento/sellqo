// REKENING-ONLINE-1 — een online betaling van een tafelrekening afronden.
//
// Gedeeld door storefront-api (de gast komt terug van Stripe) en stripe-connect-webhook
// (checkout.session.completed). Beide mogen tegelijk komen: table_check_pay_settle is
// idempotent en vergrendelt de betaling.
//
// Lukt afsluiten niet meer (een collega rekende intussen af, een lijn werd geannuleerd, het
// bedrag klopt niet), dan geeft de databank refund:true. Dan storten we hier meteen terug
// (met teruggave van de platformfee) en zetten we een melding voor de zaak. Geld blijft
// nooit hangen zonder dat iemand het weet.

export interface SettleRpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message?: string } | null }>;
  };
}

export interface RefundClient {
  refunds: { create: (params: Record<string, unknown>, opts: { stripeAccount: string; idempotencyKey?: string }) => Promise<{ id: string }> };
}

export interface SettleInput {
  paymentId: string;
  tenantId: string;
  amountTotalCents: number;
  paymentIntent: string | null;
  stripeAccount: string;
  tableLabel?: string | null;
}

export type SettleOutcome =
  | { status: 'paid'; closed: boolean; duplicate: boolean }
  | { status: 'refunded'; reason: string | null; refundId: string }
  | { status: 'refund_needed'; reason: string | null; error: string };

const REASONS: Record<string, string> = {
  CHECK_CHANGED: 'de rekening veranderde intussen',
  CHECK_CLOSED: 'de rekening werd intussen aan de kassa afgerekend',
  AMOUNT_MISMATCH: 'het betaalde bedrag klopt niet met de rekening',
  FISCAL: 'deze zaak rekent af met een geregistreerde kassa',
  NO_ADMIN: 'de zaak heeft geen beheerder',
};

export function refundReasonText(reason: string | null | undefined): string {
  if (!reason) return 'de betaling kon niet op de rekening gezet worden';
  return REASONS[reason] ?? 'de betaling kon niet op de rekening gezet worden';
}

const euro = (cents: number) => `€ ${(cents / 100).toFixed(2).replace('.', ',')}`;

export async function settleTableCheckPayment(db: SettleRpcClient, stripe: RefundClient, input: SettleInput): Promise<SettleOutcome> {
  const { data, error } = await db.rpc('table_check_pay_settle', {
    p_payment_id: input.paymentId, p_amount_total_cents: input.amountTotalCents, p_payment_intent: input.paymentIntent,
  });
  if (error) throw new Error(`table_check_pay_settle: ${error.message ?? 'onbekend'}`);
  const r = (data ?? {}) as { ok?: boolean; refund?: boolean; status?: string; reason?: string | null; duplicate?: boolean; closed?: boolean };
  if (r.ok) return { status: 'paid', closed: !!r.closed, duplicate: !!r.duplicate };
  if (r.status === 'refunded') return { status: 'refunded', reason: r.reason ?? null, refundId: '' };
  if (!r.refund) throw new Error(`table_check_pay_settle: onverwacht antwoord ${JSON.stringify(r)}`);

  // Terugstorten. Zonder payment intent kunnen we niet terugstorten: dan blijft refund_needed
  // staan en meldt de zaak het (de melding hieronder gaat sowieso).
  let refundId = '';
  let refundError = '';
  if (input.paymentIntent) {
    try {
      const refund = await stripe.refunds.create(
        { payment_intent: input.paymentIntent, refund_application_fee: true, metadata: { table_check_payment_id: input.paymentId } },
        // Review M3: webhook en gast kunnen tegelijk afronden; Stripe geeft dan dezelfde terugstorting.
        { stripeAccount: input.stripeAccount, idempotencyKey: `table_check_refund_${input.paymentId}` },
      );
      refundId = refund.id;
      const { error: markError } = await db.rpc('table_check_pay_mark', { p_payment_id: input.paymentId, p_status: 'refunded', p_session_id: null, p_refund_id: refund.id });
      if (markError) refundError = `teruggestort (${refund.id}) maar status niet bijgewerkt: ${markError.message ?? ''}`;
    } catch (e) {
      refundError = e instanceof Error ? e.message : String(e);
    }
  } else {
    refundError = 'geen payment intent';
  }

  const ok = !!refundId;
  // Eén melding per uitkomst, ook als afronden twee keer loopt. Een latere geslaagde terugstorting
  // stuurt nog wel "teruggestort", zodat een eerdere melding "mislukt" rechtgezet wordt.
  const { data: first } = await db.rpc('table_check_pay_mark', { p_payment_id: input.paymentId, p_status: ok ? 'notify_refunded' : 'notify_failed', p_session_id: null, p_refund_id: null });
  if ((first as { changed?: boolean } | null)?.changed === false) {
    return ok ? { status: 'refunded', reason: r.reason ?? null, refundId } : { status: 'refund_needed', reason: r.reason ?? null, error: refundError };
  }
  const { error: nErr } = await db.from('notifications').insert({
    tenant_id: input.tenantId,
    category: 'payments',
    type: ok ? 'table_check_refunded' : 'table_check_refund_failed',
    title: ok ? 'Online betaling aan tafel teruggestort' : 'Online betaling aan tafel: terugstorten mislukt',
    message: ok
      ? `${input.tableLabel ? `Tafel ${input.tableLabel}: ` : ''}${euro(input.amountTotalCents)} werd teruggestort omdat ${refundReasonText(r.reason)}.`
      : `${input.tableLabel ? `Tafel ${input.tableLabel}: ` : ''}${euro(input.amountTotalCents)} kon niet op de rekening en ook niet automatisch teruggestort worden. Stort terug via Stripe.`,
    priority: ok ? 'medium' : 'high',
    action_url: '/admin/pos?tab=betalen',
    data: { payment_id: input.paymentId, payment_intent: input.paymentIntent, reason: r.reason ?? null, refund_id: refundId || null, error: refundError || null },
  });
  if (nErr) console.error('[tableCheckPay] notification failed:', nErr.message);
  return ok ? { status: 'refunded', reason: r.reason ?? null, refundId } : { status: 'refund_needed', reason: r.reason ?? null, error: refundError };
}
