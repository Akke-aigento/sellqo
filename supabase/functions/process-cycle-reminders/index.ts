// CYCLE-2: daily friendly-reminder + expiry cron for pay-first billing cycles.
// Tone is a request, never a dunning notice — there is no legal claim: an
// unpaid cycle simply has not been invoiced yet.
//
// Levels:
//   1 → on/after due_date (no reminder sent yet)
//   2 → halfway through the grace window
//   3 → grace_until has passed → status 'expired' + final friendly notice
//
// Guards: only cycles without invoice_id; one reminder per cycle per day;
// skipped when a Checkout session was created in the last 7 days and no
// reminder has been sent for that session yet is not applicable — instead we
// skip cycles whose payment link is younger than 7 days at level 1.
// Expiry only touches billing_cycles.status (suspension is LOCK-1).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CYCLE-REMINDERS] ${step}${suffix}`);
};

const DAY = 24 * 60 * 60 * 1000;
const todayIso = () => new Date().toISOString().slice(0, 10);

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const summary = {
    scanned: 0,
    reminder_1: 0,
    reminder_2: 0,
    expired: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const today = todayIso();

    const { data: cycles, error } = await supabase
      .from("billing_cycles")
      .select("id, tenant_id, customer_id, status, invoice_id, payment_request_number, due_date, grace_until, reminder_level, last_reminder_at, checkout_session_created_at")
      .in("status", ["awaiting_payment", "reopened"])
      .is("invoice_id", null)
      .order("due_date", { ascending: true })
      .limit(500);
    if (error) throw error;

    summary.scanned = cycles?.length ?? 0;
    log("Cycles scanned", { count: summary.scanned, today });

    for (const cycle of cycles ?? []) {
      try {
        // Day-guard: at most one reminder per cycle per day.
        if (cycle.last_reminder_at && cycle.last_reminder_at.slice(0, 10) === today) {
          summary.skipped++;
          continue;
        }
        if (!cycle.due_date) {
          summary.skipped++;
          continue;
        }

        const level = Number(cycle.reminder_level) || 0;

        // Level 3 — grace window elapsed → expire (status only).
        if (cycle.grace_until && daysBetween(cycle.grace_until, today) > 0) {
          const { error: upErr } = await supabase
            .from("billing_cycles")
            .update({
              status: "expired",
              reminder_level: 3,
              last_reminder_at: new Date().toISOString(),
            })
            .eq("id", cycle.id)
            .in("status", ["awaiting_payment", "reopened"])
            .is("invoice_id", null)
            .select("id");
          if (upErr) throw upErr;

          await supabase.functions.invoke("dispatch-payment-request", {
            body: { billing_cycle_id: cycle.id, reminder_level: 3 },
          });

          // Notification row only on expiry (level 3).
          await supabase.from("notifications").insert({
            tenant_id: cycle.tenant_id,
            category: "subscriptions",
            priority: "high",
            title: `Betalingsverzoek ${cycle.payment_request_number ?? ""} verlopen`.trim(),
            message: "Het betalingsverzoek is verlopen. De klant kan nog steeds betalen via de betaallink; daarna volgt de factuur automatisch.",
            link: "/admin/subscriptions",
          });

          summary.expired++;
          log("Cycle expired", { billing_cycle_id: cycle.id });
          continue;
        }

        const daysSinceDue = daysBetween(cycle.due_date, today);

        // Level 1 — on/after due date, nothing sent yet.
        if (level < 1 && daysSinceDue >= 0) {
          // Skip if the customer received a fresh payment link very recently.
          const linkAge = cycle.checkout_session_created_at
            ? Date.now() - new Date(cycle.checkout_session_created_at).getTime()
            : Infinity;
          if (linkAge < 7 * DAY && daysSinceDue === 0) {
            summary.skipped++;
            continue;
          }
          await supabase.functions.invoke("dispatch-payment-request", {
            body: { billing_cycle_id: cycle.id, reminder_level: 1 },
          });
          await supabase
            .from("billing_cycles")
            .update({ reminder_level: 1, last_reminder_at: new Date().toISOString() })
            .eq("id", cycle.id)
            .select("id");
          summary.reminder_1++;
          log("Reminder 1 sent", { billing_cycle_id: cycle.id });
          continue;
        }

        // Level 2 — halfway through the grace window.
        if (level === 1 && cycle.grace_until) {
          const graceDays = daysBetween(cycle.due_date, cycle.grace_until);
          const halfway = Math.max(1, Math.floor(graceDays / 2));
          if (daysSinceDue >= halfway) {
            await supabase.functions.invoke("dispatch-payment-request", {
              body: { billing_cycle_id: cycle.id, reminder_level: 2 },
            });
            await supabase
              .from("billing_cycles")
              .update({ reminder_level: 2, last_reminder_at: new Date().toISOString() })
              .eq("id", cycle.id)
              .select("id");
            summary.reminder_2++;
            log("Reminder 2 sent", { billing_cycle_id: cycle.id });
            continue;
          }
        }

        summary.skipped++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        summary.errors.push(`${cycle.id}: ${msg}`);
        log("ERROR on cycle", { billing_cycle_id: cycle.id, error: msg });
      }
    }

    log("Done", summary);
    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("FATAL", { message });
    return new Response(JSON.stringify({ error: message, ...summary }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});