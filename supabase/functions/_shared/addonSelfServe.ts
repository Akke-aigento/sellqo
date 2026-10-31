// ADDON-SELF-1 — de zaakvoerder zet zelf een spoor (add-on) aan of uit. Pure beslisregels
// (geen I/O, getest in addonSelfServe.test.ts) plus één lader voor "lopend werk".
//
// Waterdicht, keuzes Akke 31-10 ("go aanbevolen"):
//  - B1: tijdens de proefperiode is een add-on gratis; bij de activatie van het plan komt hij
//    mee op het eerste betaalabonnement (addonsToBillOnActivation).
//  - B2: de add-on volgt het interval van het plan (bestaand gedrag van BILL-ADDON-1).
//  - B3: uitzetten met lopend werk wordt geweigerd tot het leeg is (addonDisableGuard).
// Een spoor dat SellQo gratis ontgrendelde (tenant_feature_overrides.granted_features) wordt
// nooit aangerekend, en een winkel met een openstaande betaling kan er niets bijnemen.
import type { AddonRow } from "./addonBilling.ts";
import { addonIsBilled } from "./addonBilling.ts";

export type AddonErrorCode =
  | "addon_inactive"
  | "addon_in_plan"
  | "addon_granted"
  | "account_locked"
  | "addon_in_use";

export interface AddonGuardResult {
  code: AddonErrorCode;
  status: number;
  usage?: TrackUsage;
}

/** Facturatietoestanden waarin een winkel niets nieuws mag bijnemen (billingState.ts). */
const LOCKED_STATES = new Set(["past_due", "restricted", "suspended"]);

export function addonEnableGuard(i: {
  isPlatformAdmin: boolean;
  addon: Pick<AddonRow, "track" | "active">;
  planTrack: string;
  granted: readonly string[];
  billingState: string;
}): AddonGuardResult | null {
  if (i.addon.active === false && !i.isPlatformAdmin) return { code: "addon_inactive", status: 409 };
  if (i.addon.track === i.planTrack) return { code: "addon_in_plan", status: 409 };
  // Nooit betalen voor iets dat SellQo gratis gaf (ook niet via een platformadmin: eerst de
  // ontgrendeling weghalen, dan pas aanrekenen).
  if (i.granted.includes(i.addon.track)) return { code: "addon_granted", status: 409 };
  if (!i.isPlatformAdmin && LOCKED_STATES.has(i.billingState)) return { code: "account_locked", status: 409 };
  return null;
}

export interface TrackUsage {
  /** Open horecarekeningen (dining_checks.status = 'open'). */
  open_checks: number;
  /** Komende events (vandaag of later, gepland) met verkochte tickets. */
  upcoming_ticketed_events: number;
  /** Betaalde webshop-/bol-orders die nog niet verzonden zijn. */
  open_orders: number;
}

export const NO_USAGE: TrackUsage = { open_checks: 0, upcoming_ticketed_events: 0, open_orders: 0 };

/** Zit er nog lopend werk in dit spoor? */
export function trackInUse(track: string, u: TrackUsage): boolean {
  if (track === "horeca") return u.open_checks > 0;
  if (track === "events") return u.upcoming_ticketed_events > 0;
  if (track === "webshop") return u.open_orders > 0;
  return false;
}

/** B3: uitzetten met lopend werk = weigeren. Een platformadmin kan bewust doorduwen (force). */
export function addonDisableGuard(i: {
  isPlatformAdmin: boolean;
  force: boolean;
  track: string;
  usage: TrackUsage;
}): AddonGuardResult | null {
  if (i.isPlatformAdmin && i.force) return null;
  if (trackInUse(i.track, i.usage)) return { code: "addon_in_use", status: 409, usage: i.usage };
  return null;
}

/** Loopt de proefperiode nog? (trial_end in de toekomst) */
export function inTrial(sub: { trial_end?: string | null } | null | undefined, now: Date = new Date()): boolean {
  if (!sub?.trial_end) return false;
  const t = new Date(sub.trial_end).getTime();
  return Number.isFinite(t) && t > now.getTime();
}

/**
 * B1: welke add-ons moeten op het nieuwe facturatieabonnement bij een activatie? Elk
 * betaald, actief spoor dat aan staat (business_modules), niet van het plan zelf en niet
 * gratis ontgrendeld. Zo blijft er nooit een spoor aan zonder factuurregel.
 */
export function addonsToBillOnActivation(
  modules: readonly string[] | null | undefined,
  planTrack: string,
  granted: readonly string[],
  addons: Iterable<AddonRow>,
): AddonRow[] {
  const on = new Set((modules ?? []).filter((m) => typeof m === "string"));
  const out: AddonRow[] = [];
  for (const a of addons) {
    if (a.active === false || !addonIsBilled(a)) continue;
    if (!on.has(a.track) || a.track === planTrack || granted.includes(a.track)) continue;
    out.push(a);
  }
  return out;
}

export type AddonStatus =
  | "in_plan" //      het spoor zit in het plan
  | "included" //     gratis ontgrendeld door SellQo
  | "on" //           aan (en betaald, of niet gefactureerd)
  | "stopping" //     aan, stopt op end_date
  | "pending_payment" // wacht op betaling (pro rata)
  | "trial" //        aan tijdens de proefperiode, wordt aangerekend bij de activatie
  | "off";

export function addonStatus(i: {
  track: string;
  planTrack: string;
  granted: readonly string[];
  moduleOn: boolean;
  line: { end_date?: string | null } | null;
  pendingCycle: boolean;
  trial: boolean;
  /** Heeft de add-on een vaste prijs? (events: nee, enkel ticketfee) */
  billed: boolean;
}): AddonStatus {
  if (i.track === i.planTrack) return "in_plan";
  if (i.granted.includes(i.track)) return "included";
  if (i.pendingCycle && !i.moduleOn) return "pending_payment";
  if (!i.moduleOn) return "off";
  if (i.line?.end_date) return "stopping";
  if (!i.line && i.trial && i.billed) return "trial";
  return "on";
}

/** Eerste volledige maand op een kaal facturatieabonnement (Free/Flex): bedrag incl. btw. */
export function firstPeriodTotals(net: number, vatRate: number): { net: number; vat: number; total: number } {
  const n = +net.toFixed(2);
  const vat = +(n * vatRate / 100).toFixed(2);
  return { net: n, vat, total: +(n + vat).toFixed(2) };
}

// ---------------------------------------------------------------------------
// I/O: lopend werk per spoor. Bewust smal (head-counts), zodat het snel blijft.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

export async function loadTrackUsage(supabase: Sb, tenantId: string, track: string, todayISO: string): Promise<TrackUsage> {
  const u: TrackUsage = { ...NO_USAGE };
  if (track === "horeca") {
    const { count, error } = await supabase
      .from("dining_checks").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "open");
    if (error) throw error;
    u.open_checks = count ?? 0;
  } else if (track === "events") {
    const { data: events, error } = await supabase
      .from("event_details").select("id").eq("tenant_id", tenantId).eq("status", "scheduled").gte("event_date", todayISO);
    if (error) throw error;
    const ids = ((events ?? []) as { id: string }[]).map((e) => e.id);
    if (ids.length) {
      const { data: sold, error: sErr } = await supabase
        .from("ticket_instances").select("event_detail_id").eq("tenant_id", tenantId)
        .in("event_detail_id", ids).in("status", ["valid", "checked_in"]);
      if (sErr) throw sErr;
      u.upcoming_ticketed_events = new Set(((sold ?? []) as { event_detail_id: string }[]).map((s) => s.event_detail_id)).size;
    }
  } else if (track === "webshop") {
    const { count, error } = await supabase
      .from("orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId)
      // Live 31-10: bol-orders staan als sales_channel 'webshop' of 'bol_com' (marketplace_source
      // 'bol_com'); geen enkele order zonder sales_channel. Tafel-/horeca-orders tellen niet mee.
      .in("sales_channel", ["webshop", "bol_com"]).eq("payment_status", "paid").in("status", ["pending", "processing"])
      .is("dining_table_id", null).is("service_type", null);
    if (error) throw error;
    u.open_orders = count ?? 0;
  }
  return u;
}
