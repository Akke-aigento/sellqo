// BILLING-SAFE-1 — meldingen rond betalingen van een abonnement (pay-first).
//
// Aanleiding (27-10-2026): Özay betaalde op 21-10 en 27-10, maar er bestond geen
// melding "betaling ontvangen" en een mislukte kaartafschrijving zette de cyclus
// stil op 'awaiting_payment', zonder betaalverzoek aan de klant en zonder melding
// aan de verkoper. Deze module:
//   - stuurt bij elke geslaagde betaling één melding payments/payment_received;
//   - handelt een mislukte afschrijving af: betaalverzoek met nummer, pdf en link
//     meteen naar de klant, en subscriptions/subscription_payment_failed naar de
//     verkoper — precies één keer per cyclus (claim op billing_cycles.charge_failed_at);
//   - meldt een betaling die binnenkwam maar niet verwerkt kon worden.
// Beide types bestonden al (notificationDefaults + i18n), maar werden nooit verstuurd.
// De tekstopbouw staat in pure functies zonder netwerk (getest in CI).

// Zelfde losse clientvorm als subscriptionCharge.ts (service-role client of testdubbel).
/* eslint-disable @typescript-eslint/no-explicit-any -- querybuilder-ketens zijn ongetypeerd */
type SupabaseLike = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
  functions?: { invoke: (name: string, opts?: Record<string, unknown>) => any };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[BILLING-ALERTS] ${step}${suffix}`);
};

// ---------------------------------------------------------------- pure

export function euro(amount: number): string {
  const n = Math.round((Number(amount) || 0) * 100) / 100;
  return `€${n.toFixed(2).replace(".", ",")}`;
}

/** Zinnetje voor wat er betaald werd: "PR-2026-0004 en SQ-2026-0001". */
export function joinNumbers(numbers: (string | null | undefined)[]): string {
  const list = numbers.filter((n): n is string => !!n && n.trim() !== "");
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(", ")} en ${list.at(-1)}`;
}

export interface PaymentReceivedInput {
  customerName: string;
  amount: number;
  paidFor: (string | null | undefined)[];
  newInvoiceNumbers: (string | null | undefined)[];
  /** true = factuurmail vertrokken, false = mislukt, undefined = niet van toepassing/onbekend */
  mailed?: boolean;
  subscriptionStatus?: string | null;
}

export function paymentReceivedText(i: PaymentReceivedInput): { title: string; message: string } {
  const what = joinNumbers(i.paidFor);
  const made = joinNumbers(i.newInvoiceNumbers);
  const madeText = !made
    ? ""
    : i.mailed === true
    ? `Factuur ${made} is aangemaakt en gemaild.`
    : i.mailed === false
    ? `Factuur ${made} is aangemaakt, maar de mail naar de klant mislukte: stuur ze zelf opnieuw.`
    : `Factuur ${made} is aangemaakt.`;
  const parts = [
    `${i.customerName} betaalde ${euro(i.amount)}${what ? ` voor ${what}` : ""}.`,
    madeText,
    i.subscriptionStatus ? `Abonnement van de klant: ${statusWord(i.subscriptionStatus)}.` : "",
  ].filter(Boolean);
  return { title: `Betaling ontvangen: ${euro(i.amount)} van ${i.customerName}`, message: parts.join(" ") };
}

export interface ChargeFailedInput {
  customerName: string;
  amount: number;
  prNumber: string | null;
  reason: string | null;
  graceUntil: string | null;
  requestSent: boolean;
}

export function chargeFailedText(i: ChargeFailedInput): { title: string; message: string } {
  const pr = i.prNumber ? ` (${i.prNumber})` : "";
  const parts = [
    `De automatische afschrijving van ${euro(i.amount)}${pr} bij ${i.customerName} is mislukt${i.reason ? `: ${i.reason}` : ""}.`,
    i.requestSent
      ? "De klant kreeg meteen een betaalverzoek met betaallink per mail."
      : "Het betaalverzoek kon niet automatisch verstuurd worden: stuur het zelf vanuit Abonnementen.",
    i.graceUntil ? `Zonder betaling gaat de winkel na ${nlDate(i.graceUntil)} in leesmodus.` : "",
  ].filter(Boolean);
  return { title: `Afschrijving mislukt: ${i.customerName}`, message: parts.join(" ") };
}

export function unprocessedPaymentText(i: { customerName: string; amount: number; intentId: string; step: string }) {
  return {
    title: `Betaling ontvangen maar niet verwerkt: ${i.customerName}`,
    message: `${i.customerName} betaalde ${euro(i.amount)} (Stripe ${i.intentId}), maar SellQo kon de betaling niet verwerken (${i.step}). Stripe probeert automatisch opnieuw; blijft deze melding staan, kijk het dan na.`,
  };
}

export function chargeUnclearText(i: { customerName: string; amount: number; error: string }) {
  const err = i.error.length > 160 ? `${i.error.slice(0, 157)}...` : i.error;
  return {
    title: `Afschrijving onzeker: ${i.customerName}`,
    message: `De automatische afschrijving van ${euro(i.amount)} bij ${i.customerName} gaf een fout zonder duidelijke weigering (${err}). Ze kan bij Stripe toch gelukt zijn: kijk Stripe na vóór je een betaalverzoek stuurt. Lukte ze, dan boekt SellQo ze vanzelf af.`,
  };
}

/**
 * Was een fout uit paymentIntents.create een échte weigering van de betaling?
 * Enkel dan mag de klant een betaalverzoek krijgen. Bij een time-out, netwerk-,
 * API- of databankfout is de uitkomst onbekend (de afschrijving kan gelukt zijn).
 */
export function isPaymentDecline(err: unknown): boolean {
  const e = err as { type?: string; raw?: { payment_intent?: { status?: string } } } | null;
  if (!e || typeof e !== "object") return false;
  if (e.type === "StripeCardError") return true;
  const status = e.raw?.payment_intent?.status;
  return status === "requires_payment_method";
}

/** Leesbare reden uit een Stripe-fout, zonder technische ruis. */
export function declineReason(code?: string | null, declineCode?: string | null, message?: string | null): string | null {
  const c = declineCode || code || "";
  const map: Record<string, string> = {
    insufficient_funds: "onvoldoende saldo",
    expired_card: "kaart vervallen",
    card_declined: "kaart geweigerd",
    generic_decline: "kaart geweigerd",
    do_not_honor: "kaart geweigerd door de bank",
    authentication_required: "de bank vraagt een extra bevestiging",
    lost_card: "kaart als verloren gemeld",
    stolen_card: "kaart als gestolen gemeld",
    incorrect_number: "kaartnummer ongeldig",
    processing_error: "fout bij de verwerking",
    payment_method_detached: "betaalmethode niet meer beschikbaar",
    revoked_authorization: "machtiging ingetrokken",
  };
  if (map[c]) return map[c];
  if (message) return message.length > 120 ? `${message.slice(0, 117)}...` : message;
  return c || null;
}

function statusWord(s: string): string {
  const map: Record<string, string> = {
    active: "actief",
    trialing: "proefperiode",
    past_due: "achterstallig",
    restricted: "leesmodus",
    suspended: "opgeschort",
    canceled: "stopgezet",
  };
  return map[s] ?? s;
}

function nlDate(iso: string): string {
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// ---------------------------------------------------------------- io

export async function customerDisplayName(supabase: SupabaseLike, customerId: string | null | undefined): Promise<string> {
  if (!customerId) return "Onbekende klant";
  const { data } = await supabase
    .from("customers")
    .select("company_name, first_name, last_name, email")
    .eq("id", customerId)
    .maybeSingle();
  if (!data) return "Onbekende klant";
  return data.company_name || [data.first_name, data.last_name].filter(Boolean).join(" ") || data.email || "Onbekende klant";
}

export async function customerSubscriptionStatus(supabase: SupabaseLike, customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await supabase
    .from("tenant_subscriptions")
    .select("status")
    .eq("billing_customer_id", customerId)
    .maybeSingle();
  return (data?.status as string | undefined) ?? null;
}

/**
 * Eén melding per sleutel: een webhook-retry of een tweede event voor dezelfde
 * betaling maakt geen tweede melding. De sleutel staat in data.dedupe_key.
 */
export async function notifyOnce(
  supabase: SupabaseLike,
  n: {
    tenantId: string;
    category: string;
    type: string;
    priority: "low" | "medium" | "high" | "urgent";
    title: string;
    message: string;
    dedupeKey: string;
    data?: Record<string, unknown>;
    actionUrl?: string;
  },
): Promise<boolean> {
  try {
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("tenant_id", n.tenantId)
      .eq("type", n.type)
      .contains("data", { dedupe_key: n.dedupeKey })
      .limit(1);
    if (Array.isArray(existing) && existing.length > 0) return false;
    const { error } = await supabase.from("notifications").insert({
      tenant_id: n.tenantId,
      category: n.category,
      type: n.type,
      priority: n.priority,
      title: n.title,
      message: n.message,
      action_url: n.actionUrl ?? null,
      data: { ...(n.data ?? {}), dedupe_key: n.dedupeKey },
    });
    if (error) {
      // 23505: een gelijktijdige levering maakte dezelfde melding net aan (unieke index).
      if ((error as { code?: string }).code !== "23505") {
        log("Notification insert failed", { type: n.type, error: error.message });
      }
      return false;
    }
    return true;
  } catch (e) {
    log("Notification failed", { type: n.type, error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

/**
 * Een mislukte automatische afschrijving van een cyclus. Wordt aangeroepen door de
 * runner (synchrone weigering) én door de webhook (payment_intent.payment_failed
 * van een mandaat-afschrijving). De claim op charge_failed_at zorgt dat de klant
 * één betaalverzoek krijgt en de verkoper één melding, ook als beide paden lopen.
 */
export async function handleCycleChargeFailure(
  supabase: SupabaseLike,
  input: { cycleId: string; reason: string | null; intentId?: string | null },
): Promise<{ claimed: boolean; requestSent: boolean }> {
  const { data: claimed, error: claimErr } = await supabase
    .from("billing_cycles")
    .update({ charge_failed_at: new Date().toISOString(), charge_failure_reason: input.reason })
    .eq("id", input.cycleId)
    .is("charge_failed_at", null)
    .is("invoice_id", null)
    .not("status", "in", "(settled,cancelled)")
    .select("id, tenant_id, customer_id, total, payment_request_number, grace_until");
  if (claimErr) {
    log("Failure claim failed", { cycleId: input.cycleId, error: claimErr.message });
    return { claimed: false, requestSent: false };
  }
  const cycle = Array.isArray(claimed) ? claimed[0] : null;
  if (!cycle) return { claimed: false, requestSent: false };

  // 1. Betaalverzoeknummer (de pdf weigert zonder nummer).
  let prNumber: string | null = cycle.payment_request_number ?? null;
  if (!prNumber) {
    const { data, error } = await supabase.rpc("generate_payment_request_number", { _tenant_id: cycle.tenant_id });
    if (error) {
      log("PR number failed", { cycleId: cycle.id, error: error.message });
    } else if (data) {
      prNumber = String(data);
      const { error: upErr } = await supabase
        .from("billing_cycles")
        .update({ payment_request_number: prNumber })
        .eq("id", cycle.id)
        .is("payment_request_number", null);
      if (upErr) log("PR number save failed", { cycleId: cycle.id, error: upErr.message });
    }
  }

  // 2. Betaalverzoek (link + pdf + mail) meteen naar de klant.
  let requestSent = false;
  try {
    if (!supabase.functions?.invoke) throw new Error("functions client ontbreekt");
    const { data, error } = await supabase.functions.invoke("dispatch-payment-request", {
      body: { billing_cycle_id: cycle.id },
    });
    if (error) throw error;
    requestSent = (data as { success?: boolean } | null)?.success === true;
  } catch (e) {
    log("Dispatch failed", { cycleId: cycle.id, error: e instanceof Error ? e.message : String(e) });
  }

  // 3. Melding aan de verkoper.
  const customerName = await customerDisplayName(supabase, cycle.customer_id);
  const text = chargeFailedText({
    customerName,
    amount: Number(cycle.total ?? 0),
    prNumber,
    reason: input.reason,
    graceUntil: cycle.grace_until ?? null,
    requestSent,
  });
  await notifyOnce(supabase, {
    tenantId: cycle.tenant_id,
    category: "subscriptions",
    type: "subscription_payment_failed",
    priority: "high",
    title: text.title,
    message: text.message,
    dedupeKey: `charge_failed:${cycle.id}`,
    data: { billing_cycle_id: cycle.id, payment_intent_id: input.intentId ?? null, payment_request_number: prNumber },
  });
  log("Charge failure handled", { cycleId: cycle.id, prNumber, requestSent });
  return { claimed: true, requestSent };
}

/**
 * Een afschrijving met onbekende uitkomst (time-out, netwerk- of databankfout in de
 * runner). Geen betaalverzoek aan de klant — dat zou tot dubbele betaling kunnen
 * leiden — wel één melding per cyclus en dag aan de verkoper.
 */
export async function notifyChargeUnclear(
  supabase: SupabaseLike,
  input: { cycleId: string; error: string },
): Promise<void> {
  try {
    const { data: cycle } = await supabase
      .from("billing_cycles")
      .select("id, tenant_id, customer_id, total")
      .eq("id", input.cycleId)
      .maybeSingle();
    if (!cycle) return;
    const text = chargeUnclearText({
      customerName: await customerDisplayName(supabase, cycle.customer_id),
      amount: Number(cycle.total ?? 0),
      error: input.error,
    });
    await notifyOnce(supabase, {
      tenantId: cycle.tenant_id,
      category: "subscriptions",
      type: "subscription_payment_failed",
      priority: "high",
      title: text.title,
      message: text.message,
      dedupeKey: `charge_unclear:${cycle.id}:${new Date().toISOString().slice(0, 10)}`,
      data: { billing_cycle_id: cycle.id },
    });
  } catch (e) {
    log("Unclear-charge notification failed", { cycleId: input.cycleId, error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * De betaling is alsnog verwerkt: het alarm "betaling ontvangen maar niet verwerkt"
 * van een eerdere poging klopt niet meer en verdwijnt.
 */
export async function clearUnprocessedAlert(supabase: SupabaseLike, intentId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("type", "payment_unprocessed")
      .eq("data->>dedupe_key", `unprocessed:${intentId}`);
    if (error) log("Clearing unprocessed alert failed", { intentId, error: error.message });
  } catch (e) {
    log("Clearing unprocessed alert failed", { intentId, error: e instanceof Error ? e.message : String(e) });
  }
}
