// BILL-ADDON-1 — add-onregels op het platform-facturatieabonnement lezen en herprijzen.
// Gebruikt door sync-tenant-plan, planEffectuate en generate-subscription-invoices.
import { addonLineDescription, addonPrice, type AddonRow, tenantIsNotBilled } from "./addonBilling.ts";

// deno-lint-ignore no-explicit-any
type Sb = any;

export async function loadAddons(supabase: Sb): Promise<Map<string, AddonRow>> {
  const { data, error } = await supabase.from("platform_addons").select("id, name, track, monthly_price, yearly_price, ticket_fee, active");
  if (error) throw error;
  return new Map(((data ?? []) as AddonRow[]).map((a) => [a.id, a]));
}

/** Som van de add-onprijzen op dit abonnement tegen een interval (voor pro rata). */
export async function addonsNetFor(
  supabase: Sb,
  subscriptionId: string,
  interval: "monthly" | "yearly",
  /** Spoor van het nieuwe plan: een add-on van dat spoor valt weg bij de wissel. */
  excludeTrack?: string | null,
): Promise<number> {
  const { data, error } = await supabase
    .from("subscription_lines").select("addon_id, quantity").eq("subscription_id", subscriptionId).eq("kind", "addon").is("end_date", null);
  if (error) throw error;
  if (!data?.length) return 0;
  const addons = await loadAddons(supabase);
  return +data.reduce((s: number, l: { addon_id: string; quantity: number | null }) => {
    const a = addons.get(l.addon_id);
    if (!a || (excludeTrack && a.track === excludeTrack)) return s;
    return s + addonPrice(a, interval) * Number(l.quantity ?? 1);
  }, 0).toFixed(2);
}

/** Na een intervalwissel: elke add-onregel naar de prijs van het nieuwe interval. */
export async function repriceAddonLines(supabase: Sb, subscriptionId: string, interval: "monthly" | "yearly"): Promise<number> {
  const { data, error } = await supabase
    .from("subscription_lines").select("id, addon_id").eq("subscription_id", subscriptionId).eq("kind", "addon");
  if (error) throw error;
  if (!data?.length) return 0;
  const addons = await loadAddons(supabase);
  let n = 0;
  for (const l of data as { id: string; addon_id: string }[]) {
    const a = addons.get(l.addon_id);
    if (!a) continue;
    const { error: uErr } = await supabase
      .from("subscription_lines").update({ unit_price: addonPrice(a, interval), description: addonLineDescription(a, interval) }).eq("id", l.id);
    if (uErr) throw uErr;
    n++;
  }
  return n;
}

export async function hasAddonLines(supabase: Sb, subscriptionId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("subscription_lines").select("id", { count: "exact", head: true }).eq("subscription_id", subscriptionId).eq("kind", "addon");
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Eén spoor in tenants.business_modules (text[], TRACKS-1: bv. {horeca,events}) aan/uit. */
export async function setTenantModule(supabase: Sb, tenantId: string, track: string, on: boolean): Promise<void> {
  const { data, error } = await supabase.from("tenants").select("business_modules").eq("id", tenantId).maybeSingle();
  if (error) throw error;
  const mods = ((data?.business_modules ?? []) as string[]).filter((m) => typeof m === "string");
  const has = mods.includes(track);
  if (has === on) return;
  const next = on ? [...mods, track] : mods.filter((m) => m !== track);
  const { error: uErr } = await supabase.from("tenants").update({ business_modules: next }).eq("id", tenantId);
  if (uErr) throw uErr;
}

/**
 * Alle add-ons uit (meteen opzeggen, terug naar Free). Nooit bij winkels die SellQo niet
 * factureert (vrijgesteld, intern, demo, on hold): die kregen hun modules zonder betaling.
 * Geeft true als er iets veranderde.
 */
export async function clearBilledModules(supabase: Sb, tenantId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("tenants")
    .select("business_modules, billing_exempt, is_internal_tenant, is_demo, billing_on_hold")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data || tenantIsNotBilled(data)) return false;
  if (!((data.business_modules ?? []) as string[]).length) return false;
  const { error: uErr } = await supabase.from("tenants").update({ business_modules: [] }).eq("id", tenantId);
  if (uErr) throw uErr;
  return true;
}

/**
 * Een add-on die in het nieuwe plan zit (bv. Horeca-add-on → Horeca Big): regel weg en
 * het spoor uit business_modules (het plan dekt het nu; bij een latere downgrade mag het
 * niet onbetaald blijven hangen). Geeft het aantal verwijderde regels.
 */
export async function dropAddonsForTrack(supabase: Sb, subscriptionId: string, tenantId: string | null, track: string | null | undefined): Promise<number> {
  if (!track) return 0;
  const { data, error } = await supabase
    .from("subscription_lines").select("id, addon_id").eq("subscription_id", subscriptionId).eq("kind", "addon");
  if (error) throw error;
  if (!data?.length) return 0;
  const addons = await loadAddons(supabase);
  const hit = (data as { id: string; addon_id: string }[]).filter((l) => addons.get(l.addon_id)?.track === track);
  for (const l of hit) {
    const { error: dErr } = await supabase.from("subscription_lines").delete().eq("id", l.id);
    if (dErr) throw dErr;
  }
  if (hit.length && tenantId) await setTenantModule(supabase, tenantId, track, false);
  return hit.length;
}

/** Alle lopende add-onregels laten stoppen op `endDate` (laatste betaalde dag). */
export async function endAddonLines(supabase: Sb, subscriptionId: string, endDate: string): Promise<number> {
  const { data, error } = await supabase
    .from("subscription_lines").update({ end_date: endDate })
    .eq("subscription_id", subscriptionId).eq("kind", "addon").is("end_date", null).select("id");
  if (error) throw error;
  return (data ?? []).length;
}

/** Add-onregel erop + module aan (na betaling of geslaagd mandaat). Idempotent. */
export async function activateAddonLine(
  supabase: Sb,
  p: { subscriptionId: string; tenantId: string; addon: AddonRow; interval: "monthly" | "yearly"; vatRate?: number },
): Promise<void> {
  const { error } = await supabase.from("subscription_lines").insert({
    subscription_id: p.subscriptionId,
    kind: "addon",
    addon_id: p.addon.id,
    description: addonLineDescription(p.addon, p.interval),
    quantity: 1,
    unit_price: addonPrice(p.addon, p.interval),
    vat_rate: p.vatRate ?? 21,
    sort_order: 10,
  });
  // 23505 = staat er al (tweede webhook, of mandaat + webhook): niets aanraken, ook geen
  // geplande stop intrekken (dat gebeurt alleen expliciet in sync-tenant-plan).
  if (error && error.code === "23505") return;
  if (error) throw error;
  await setTenantModule(supabase, p.tenantId, p.addon.track, true);
}

/**
 * Webhook: een betaalde add-on-pro-rata-cyclus (target_plan_id null, lines[0].addon_id)
 * zet de add-on aan. Geeft true als het een add-oncyclus was.
 */
export async function effectuateAddonCycle(
  supabase: Sb,
  cycle: { subscription_id?: string | null; lines?: unknown },
): Promise<boolean> {
  const first = Array.isArray(cycle.lines) ? (cycle.lines[0] as { kind?: string; addon_id?: string } | undefined) : undefined;
  if (!first || first.kind !== "addon" || !first.addon_id || !cycle.subscription_id) return false;
  const addons = await loadAddons(supabase);
  const addon = addons.get(first.addon_id);
  if (!addon) return false;
  const { data: ts } = await supabase
    .from("tenant_subscriptions").select("tenant_id").eq("billing_subscription_id", cycle.subscription_id).maybeSingle();
  const { data: sub } = await supabase.from("subscriptions").select("interval, status").eq("id", cycle.subscription_id).maybeSingle();
  if (!ts?.tenant_id || !sub || sub.status !== "active") return false;
  await activateAddonLine(supabase, {
    subscriptionId: cycle.subscription_id,
    tenantId: ts.tenant_id,
    addon,
    interval: sub.interval === "yearly" ? "yearly" : "monthly",
  });
  return true;
}
