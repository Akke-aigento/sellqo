// ADDON-SELF-1 — beslisregels voor zelf een spoor bijnemen.
// Run: deno test --no-lock --node-modules-dir=none supabase/functions/_shared/addonSelfServe.test.ts
import {
  addonDisableGuard,
  addonEnableGuard,
  addonStatus,
  addonsToBillOnActivation,
  firstPeriodTotals,
  inTrial,
  NO_USAGE,
  trackInUse,
} from "./addonSelfServe.ts";
import type { AddonRow } from "./addonBilling.ts";
import { isAddonRequestCycle, resolveBillingState } from "./billingState.ts";

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
}

const WEB: AddonRow = { id: "addon_webshop", name: "Webshop-add-on", track: "webshop", monthly_price: 19, yearly_price: 190, active: true };
const HOR: AddonRow = { id: "addon_horeca", name: "Horeca-add-on", track: "horeca", monthly_price: 29, yearly_price: 290, active: true };
const EVT: AddonRow = { id: "addon_events", name: "Events-add-on", track: "events", monthly_price: 0, yearly_price: 0, ticket_fee: 0.69, active: true };

Deno.test("aanzetten: spoor van het plan, gratis ontgrendeld, op slot", () => {
  const base = { isPlatformAdmin: false, planTrack: "horeca", granted: [] as string[], billingState: "active" };
  eq(addonEnableGuard({ ...base, addon: WEB }), null, "gewoon toegelaten");
  eq(addonEnableGuard({ ...base, addon: HOR })?.code, "addon_in_plan", "eigen spoor");
  eq(addonEnableGuard({ ...base, addon: WEB, granted: ["webshop"] })?.code, "addon_granted", "gratis ontgrendeld");
  eq(addonEnableGuard({ ...base, addon: WEB, isPlatformAdmin: true, granted: ["webshop"] })?.code, "addon_granted", "ook admin betaalt nooit voor gratis");
  for (const s of ["past_due", "restricted", "suspended"]) {
    eq(addonEnableGuard({ ...base, addon: WEB, billingState: s })?.code, "account_locked", `op slot (${s})`);
    eq(addonEnableGuard({ ...base, addon: WEB, billingState: s, isPlatformAdmin: true }), null, `admin mag (${s})`);
  }
  eq(addonEnableGuard({ ...base, addon: WEB, billingState: "trialing" }), null, "proefperiode mag");
  eq(addonEnableGuard({ ...base, addon: { ...WEB, active: false } })?.code, "addon_inactive", "uitgezette add-on");
});

Deno.test("uitzetten met lopend werk (B3)", () => {
  const base = { isPlatformAdmin: false, force: false };
  eq(addonDisableGuard({ ...base, track: "horeca", usage: NO_USAGE }), null, "leeg = mag");
  eq(addonDisableGuard({ ...base, track: "horeca", usage: { ...NO_USAGE, open_checks: 2 } })?.code, "addon_in_use", "open rekeningen");
  eq(addonDisableGuard({ ...base, track: "events", usage: { ...NO_USAGE, upcoming_ticketed_events: 1 } })?.code, "addon_in_use", "verkochte tickets");
  eq(addonDisableGuard({ ...base, track: "webshop", usage: { ...NO_USAGE, open_orders: 3 } })?.code, "addon_in_use", "open orders");
  eq(addonDisableGuard({ ...base, track: "webshop", usage: { ...NO_USAGE, open_checks: 3 } }), null, "ander spoor telt niet");
  eq(addonDisableGuard({ isPlatformAdmin: false, force: true, track: "horeca", usage: { ...NO_USAGE, open_checks: 1 } })?.code, "addon_in_use", "force enkel voor admin");
  eq(addonDisableGuard({ isPlatformAdmin: true, force: true, track: "horeca", usage: { ...NO_USAGE, open_checks: 1 } }), null, "admin met force");
  eq(addonDisableGuard({ isPlatformAdmin: true, force: false, track: "horeca", usage: { ...NO_USAGE, open_checks: 1 } })?.code, "addon_in_use", "admin zonder force");
  eq(trackInUse("onbekend", { open_checks: 9, upcoming_ticketed_events: 9, open_orders: 9 }), false, "onbekend spoor");
});

Deno.test("proefperiode", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  eq(inTrial({ trial_end: "2026-11-05T00:00:00Z" }, now), true, "loopt");
  eq(inTrial({ trial_end: "2026-10-30T00:00:00Z" }, now), false, "voorbij");
  eq(inTrial({ trial_end: null }, now), false, "geen trial");
  eq(inTrial(null, now), false, "geen abonnement");
});

Deno.test("B1: add-ons op het eerste betaalabonnement", () => {
  const all = [WEB, HOR, EVT];
  eq(addonsToBillOnActivation(["webshop", "events"], "horeca", [], all).map((a) => a.id), ["addon_webshop"], "events (€0) nooit een regel");
  eq(addonsToBillOnActivation(["webshop"], "webshop", [], all), [], "spoor van het plan");
  eq(addonsToBillOnActivation(["webshop"], "horeca", ["webshop"], all), [], "gratis ontgrendeld");
  eq(addonsToBillOnActivation(["horeca", "webshop"], "events", [], all).map((a) => a.id), ["addon_webshop", "addon_horeca"], "beide betaald");
  eq(addonsToBillOnActivation(null, "events", [], all), [], "geen modules");
  eq(addonsToBillOnActivation(["webshop"], "horeca", [], [{ ...WEB, active: false }]), [], "inactieve add-on");
});

Deno.test("status per spoor", () => {
  const base = { planTrack: "horeca", granted: [] as string[], moduleOn: false, line: null, pendingCycle: false, trial: false, billed: true };
  eq(addonStatus({ ...base, track: "horeca" }), "in_plan", "plan");
  eq(addonStatus({ ...base, track: "webshop", granted: ["webshop"] }), "included", "ontgrendeld");
  eq(addonStatus({ ...base, track: "webshop" }), "off", "uit");
  eq(addonStatus({ ...base, track: "webshop", pendingCycle: true }), "pending_payment", "wacht op betaling");
  eq(addonStatus({ ...base, track: "webshop", moduleOn: true, line: {} }), "on", "aan");
  eq(addonStatus({ ...base, track: "webshop", moduleOn: true, line: { end_date: "2026-11-30" } }), "stopping", "stopt");
  eq(addonStatus({ ...base, track: "webshop", moduleOn: true, trial: true }), "trial", "trial zonder regel");
  eq(addonStatus({ ...base, track: "events", moduleOn: true, trial: true, billed: false }), "on", "events tijdens trial: nooit aangerekend");
});

Deno.test("eerste maand incl. btw", () => {
  eq(firstPeriodTotals(19, 21), { net: 19, vat: 3.99, total: 22.99 }, "webshop");
  eq(firstPeriodTotals(29, 21), { net: 29, vat: 6.09, total: 35.09 }, "horeca");
});

Deno.test("review: een onbetaald add-onverzoek zet een winkel nooit op slot", () => {
  const now = "2026-11-30T12:00:00Z";
  const req = { status: "expired", due_date: "2026-11-01", grace_until: "2026-11-08", total: 35.09, cycle_type: "proration", target_plan_id: null, lines: [{ kind: "addon", addon_id: "addon_horeca" }] };
  eq(isAddonRequestCycle(req), true, "herkend");
  eq(resolveBillingState({ cycles: [req], now }).state, "active", "verlopen verzoek = geen schuld");
  const upgrade = { ...req, target_plan_id: "pro", lines: [{ kind: "plan" }] };
  eq(isAddonRequestCycle(upgrade), false, "planupgrade blijft tellen");
  eq(resolveBillingState({ cycles: [upgrade], now }).state, "restricted", "verlopen upgrade telt wel");
  const recurring = { ...req, cycle_type: "recurring", lines: [{ kind: "addon" }] };
  eq(isAddonRequestCycle(recurring), false, "gewone maandfactuur met add-on telt wel");
  eq(isAddonRequestCycle({ status: "expired" } as never), false, "oude aanroepers zonder velden: ongewijzigd");
});

Deno.test("review 2: via het mandaat aangerekend (SEPA processing, later mislukt) = wél schuld", () => {
  const now = "2026-11-30T12:00:00Z";
  const failedSepa = { status: "expired", due_date: "2026-11-01", grace_until: "2026-11-08", total: 35.09, cycle_type: "proration", target_plan_id: null, mode: "mandate", lines: [{ kind: "addon", addon_id: "addon_horeca" }] };
  eq(isAddonRequestCycle(failedSepa), false, "add-on stond al aan → geen verzoek");
  eq(resolveBillingState({ cycles: [failedSepa], now }).state, "restricted", "escaleert zoals voorheen");
  eq(isAddonRequestCycle({ ...failedSepa, mode: "manual" }), true, "betaalverzoek (manueel) = verzoek");
});
