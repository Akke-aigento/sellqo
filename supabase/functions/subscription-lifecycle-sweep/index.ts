// SUB-UNIFY-2A (16-10-2026) — dagelijkse sweep: betaalde periode voorbij en
// opgezegd of gestopt → de winkel gaat naar Free.
//
// Waarom: na een opzegging bleef het betaalde plan voor altijd staan (gat L1), en een
// rechtstreeks geannuleerd facturatie-abonnement gaf gratis toegang voor altijd (L3).
// Zie docs/prepared/2026-10-16-billing-batchplannen.md §3.3. Sinds deze batch gaat een
// opzegging pas in op het einde van de betaalde periode (sync-tenant-plan); deze
// functie voert die overgang uit.
//
// De beslissing per winkel zit in _shared/planLifecycle.ts (decidePlanEnding, getest).
// Uitgesloten: de facturatietenant, eigen winkels (billing_exempt / is_internal_tenant),
// "gratis tot omschakeling" (billing_on_hold: Mancini, Zona Dorata, Benny Rich), demo's,
// een lopende proef en rijen zonder periode-einde.
//
// VEILIGHEID (geld):
//   * STANDAARD DRY-RUN. Alleen `{ "dry_run": false }` schrijft. Elke andere body
//     (ook de lege, ook die van de cron) rapporteert enkel.
//   * Geen Stripe-call, geen billing_cycles, geen facturen, geen mails. In de echte
//     modus alleen: tenant_subscriptions → free, het facturatie-abonnement op
//     'cancelled' (als het nog actief is), tenants.subscription_plan → 'free', en één
//     melding subscriptions/plan_ended aan de winkel zelf.
//   * Openstaande cycli van het facturatie-abonnement worden alleen GEMELD
//     (open_cycles), nooit aangeraakt.
//
// Auth: alleen cron of een andere functie (cron-secret of service-key). GET = versiestempel.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { denyUnlessCron } from "../_shared/marketplaceSyncAuth.ts";
import { buildSweepRow, decidePlanEnding, type SweepDecision, type SweepRow } from "../_shared/planLifecycle.ts";
import { clearBilledModules } from "../_shared/addonLines.ts";

const VERSION = "SUB-UNIFY-2A";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const errMsg = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);

const OPEN_CYCLE_STATUSES = ["pending", "awaiting_payment", "processing", "reopened"];

interface ReportRow {
  tenant: string;
  tenant_id: string;
  slug: string | null;
  plan_id: string | null;
  status: string | null;
  billing_subscription_status: string | null;
  current_period_end: string | null;
  action: SweepDecision["action"];
  reason: string | null;
  triggers: string[];
  would_do: string;
  open_cycles: number;
  applied?: boolean;
  error?: string;
}

function describe(d: SweepDecision, row: SweepRow): string {
  switch (d.action) {
    case "downgrade":
      return `plan ${row.plan_id} → free` +
        (row.billing_subscription_status === "active" ? ", facturatie-abonnement → cancelled" : "") +
        ", tenants.subscription_plan → free, betaalde add-ons uit, melding subscriptions/plan_ended";
    case "scheduled":
      return d.reason === "commitment_running"
        ? `niets: contract loopt tot ${row.pending_effective_at}, daarna Free`
        : `niets: periode loopt tot ${row.current_period_end}, daarna Free`;
    case "excluded":
      return `niets: uitgesloten (${d.reason})`;
    default:
      return "niets";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // Versiestempel om een deploy zonder neveneffect na te meten (geen auth, geen data).
  if (req.method === "GET") return json({ ok: true, version: VERSION });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const denied = await denyUnlessCron(req, supabase, corsHeaders);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    // Alleen een expliciete false schrijft. Alles anders is een dry-run.
    const dryRun = body?.dry_run !== false;
    const onlyTenant: string | undefined = typeof body?.tenant_id === "string" ? body.tenant_id : undefined;
    const includeIgnored = body?.include_ignored === true;
    const now = new Date();

    const { data: subs, error: subsErr } = await supabase
      .from("tenant_subscriptions")
      .select(
        "tenant_id, plan_id, status, current_period_end, trial_end, cancel_at_period_end, pending_plan_id, pending_effective_at, billing_subscription_id, " +
          "tenants(name, slug, is_demo, is_internal_tenant, billing_exempt, billing_on_hold), " +
          "pricing_plan:pricing_plans!plan_id(id, slug, monthly_price, yearly_price)",
      );
    if (subsErr) throw subsErr;
    // De select is samengesteld (embeds), dus de types kunnen hem niet ontleden.
    const subRows = (subs ?? []) as unknown as Array<Record<string, unknown>>;

    const billingIds = subRows
      .map((s) => s.billing_subscription_id as string | null)
      .filter((id): id is string => !!id);
    const billingById = new Map<string, { id: string; status: string | null }>();
    const openCyclesBySub = new Map<string, number>();
    if (billingIds.length > 0) {
      const { data: bs, error: bsErr } = await supabase
        .from("subscriptions")
        .select("id, status")
        .in("id", billingIds);
      if (bsErr) throw bsErr;
      for (const b of (bs ?? []) as Array<{ id: string; status: string | null }>) billingById.set(b.id, b);

      const { data: cycles, error: cyErr } = await supabase
        .from("billing_cycles")
        .select("id, subscription_id")
        .in("subscription_id", billingIds)
        .in("status", OPEN_CYCLE_STATUSES)
        .is("invoice_id", null);
      if (cyErr) throw cyErr;
      for (const c of (cycles ?? []) as Array<{ subscription_id: string }>) {
        openCyclesBySub.set(c.subscription_id, (openCyclesBySub.get(c.subscription_id) ?? 0) + 1);
      }
    }

    const rows: ReportRow[] = [];
    let applied = 0;
    const failed: Array<{ tenant_id: string; error: string }> = [];

    for (const s of subRows) {
      const tenantId = s.tenant_id as string;
      if (onlyTenant && tenantId !== onlyTenant) continue;
      const billingId = (s.billing_subscription_id as string | null) ?? null;
      const billing = billingId ? billingById.get(billingId) ?? null : null;
      const row: SweepRow = buildSweepRow(s, billing);

      const decision = decidePlanEnding(row, now);
      if (decision.action === "ignore" && !includeIgnored) continue;

      const report: ReportRow = {
        tenant: row.tenant_name ?? tenantId,
        tenant_id: tenantId,
        slug: row.slug ?? null,
        plan_id: row.plan_id ?? null,
        status: row.status ?? null,
        billing_subscription_status: row.billing_subscription_status ?? null,
        current_period_end: row.current_period_end ?? null,
        action: decision.action,
        reason: "reason" in decision ? decision.reason : null,
        triggers: "triggers" in decision ? decision.triggers : [],
        would_do: describe(decision, row),
        open_cycles: billingId ? openCyclesBySub.get(billingId) ?? 0 : 0,
      };
      rows.push(report);

      if (decision.action !== "downgrade" || dryRun) continue;

      try {
        // 1. Plan → free. Guard op het oude plan: liep er intussen een planwissel, dan niets.
        const { data: upd, error: tsErr } = await supabase
          .from("tenant_subscriptions")
          .update({
            plan_id: "free",
            status: "canceled",
            cancel_at_period_end: false,
            pending_plan_id: null,
            pending_interval: null,
            pending_effective_at: null,
            commitment_end_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", tenantId)
          .eq("plan_id", row.plan_id!)
          .select("id");
        if (tsErr) throw tsErr;
        if (!upd || upd.length === 0) {
          report.applied = false;
          report.error = "plan intussen gewijzigd, overgeslagen";
          continue;
        }

        // 2. Facturatie-abonnement stoppen (geen nieuwe cyclus meer). Openstaande cycli blijven.
        if (billingId && billing?.status === "active") {
          const { error: bErr } = await supabase
            .from("subscriptions")
            .update({ status: "cancelled" })
            .eq("id", billingId)
            .eq("status", "active");
          if (bErr) throw bErr;
        }

        // 3. Gedenormaliseerd planlabel (service_role, mag sinds SEC-BILL-1).
        const { error: lErr } = await supabase.from("tenants").update({ subscription_plan: "free" }).eq("id", tenantId);
        if (lErr) throw lErr;

        // 3b. BILL-ADDON-1: op Free geen betaalde add-ons meer (niet bij vrijgestelde/demo-winkels).
        if (await clearBilledModules(supabase, tenantId)) report.triggers.push("addons_off");

        // 4. Melding aan de winkel zelf.
        const { error: nErr } = await supabase.from("notifications").insert({
          tenant_id: tenantId,
          category: "subscriptions",
          type: "plan_ended",
          priority: "high",
          title: "Je abonnement is afgelopen",
          message: "Je betaalde periode is voorbij. Je winkel staat nu op Free. Je kan altijd opnieuw een plan kiezen onder Abonnement.",
          action_url: "/admin/billing",
          data: { previous_plan_id: row.plan_id, period_end: row.current_period_end, triggers: report.triggers },
        });
        if (nErr) console.error(`[LIFECYCLE-SWEEP] notification failed for ${tenantId}: ${nErr.message}`);

        report.applied = true;
        applied++;
        console.log(`[LIFECYCLE-SWEEP] ${tenantId} ${row.plan_id} → free (${report.triggers.join(",")})`);
      } catch (e) {
        report.applied = false;
        report.error = errMsg(e);
        failed.push({ tenant_id: tenantId, error: report.error });
      }
    }

    const count = (a: SweepDecision["action"]) => rows.filter((r) => r.action === a).length;
    return json({
      success: true,
      version: VERSION,
      dry_run: dryRun,
      now: now.toISOString(),
      downgrade: count("downgrade"),
      scheduled: count("scheduled"),
      excluded: count("excluded"),
      applied,
      failed,
      rows,
    });
  } catch (error) {
    const message = errMsg(error);
    console.error("[LIFECYCLE-SWEEP] ERROR", message);
    return json({ error: message }, 500);
  }
});
