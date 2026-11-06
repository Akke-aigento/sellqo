// ZAAL-H1 — tafels uit het horeca-zaalplan voor de storefront: een QR-token (?t=…)
// omzetten naar de tafel, en beslissen of een vrij tafelnummer (?tafel=4) nog mag.
// Regel: een zaak MET zaalplan (minstens één actieve tafel) aanvaardt enkel geldige
// tokens; een zaak zonder zaalplan werkt zoals voorheen met het vrije nummer.
// De token is geheim: dining_tables heeft geen anon-rechten, alleen de service role
// (deze edge function) leest hem.
import type { SupabaseLike } from "./catalogFilters.ts";

export const TABLE_TOKEN_RE = /^[0-9a-f]{24,64}$/;
/** Vrij tafelnummer zoals checkout_table het al sinds HORECA-1 aanvaardt. */
export const FREE_TABLE_RE = /^[\w-]{1,12}$/;

export interface ResolvedTable {
  table_id: string | null;
  label: string;
  /** HORECA-NU-2a: is_open (additief) = de zone staat open; false = tijdelijk dicht (bv. het terras). */
  area: { id: string; name: string; is_open: boolean } | null;
}

export type TableResolution =
  | { ok: true; table: ResolvedTable }
  | { ok: false; code: "TABLE_NOT_FOUND" | "TABLE_TOKEN_REQUIRED" | "VALIDATION_ERROR"; message: string };

/** Heeft deze winkel een zaalplan (minstens één actieve tafel)? */
export async function tenantHasFloorPlan(supabase: SupabaseLike, tenantId: string): Promise<boolean> {
  const { count, error } = await supabase.from("dining_tables")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).eq("is_active", true);
  // Tabel bestaat nog niet (migratie niet gedraaid) → geen zaalplan, oud gedrag.
  // Elke andere fout: niet stil terugvallen op het vrije nummer (dat is net het misbruik).
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return false;
    throw error;
  }
  return (count ?? 0) > 0;
}

/** Token → actieve tafel in een actieve ruimte van deze winkel. */
export async function resolveTableToken(supabase: SupabaseLike, tenantId: string, token: string): Promise<TableResolution> {
  const tk = String(token ?? "").trim().toLowerCase();
  if (!TABLE_TOKEN_RE.test(tk)) return { ok: false, code: "TABLE_NOT_FOUND", message: "Deze QR-code hoort bij geen tafel (meer)" };
  const { data: tb } = await supabase.from("dining_tables")
    .select("id, label, area_id, is_active")
    .eq("tenant_id", tenantId).eq("qr_token", tk).eq("is_active", true).maybeSingle();
  if (!tb) return { ok: false, code: "TABLE_NOT_FOUND", message: "Deze QR-code hoort bij geen tafel (meer)" };
  const { data: area } = await supabase.from("dining_areas")
    .select("id, name, is_active")
    .eq("tenant_id", tenantId).eq("id", tb.area_id).maybeSingle();
  if (!area || area.is_active === false) return { ok: false, code: "TABLE_NOT_FOUND", message: "Deze QR-code hoort bij geen tafel (meer)" };
  return { ok: true, table: { table_id: String(tb.id), label: String(tb.label), area: { id: String(area.id), name: String(area.name), is_open: await areaIsOpen(supabase, tenantId, String(area.id)) } } };
}

/**
 * HORECA-NU-2a — staat deze zone open? Apart gelezen, zoals allergens_declared: vóór de migratie (kolom
 * bestaat niet, 42703) of bij elke andere leesfout blijft het oude gedrag (open). Een dichte zone weigert
 * nooit door een fout, enkel door een expliciete is_open = false.
 */
export async function areaIsOpen(supabase: SupabaseLike, tenantId: string, areaId: string): Promise<boolean> {
  const { data, error } = await supabase.from("dining_areas")
    .select("id, is_open")
    .eq("tenant_id", tenantId).eq("id", areaId).maybeSingle();
  if (error || !data) return true;
  return data.is_open !== false;
}

/** HORECA-NU-2a — foutmelding voor de gast aan een tafel in een dichte zone (zelfde stijl als de andere API-meldingen). */
export const ZONE_CLOSED = "ZONE_CLOSED" as const;
export function zoneClosedError(table: ResolvedTable): { code: typeof ZONE_CLOSED; message: string } | null {
  if (!table.area || table.area.is_open !== false) return null;
  return { code: ZONE_CLOSED, message: `${table.area.name} is momenteel gesloten. Bestellen of de bediening roepen kan hier nu niet.` };
}

/**
 * HORECA-NU-1b — zone van een tafel die al op het mandje staat (dining_table_id), opnieuw opgezocht
 * vlak vóór de bestelling (checkout_complete, ook via checkout_place_order). Zo helpt het niet om eerst
 * checkout_table te doen en pas na het dichtzetten van de zone af te rekenen. Elke lookup filtert op de
 * winkel; een leesfout, een ontbrekende kolom of een onbekende tafel blijft "open" (zoals areaIsOpen):
 * een dichte zone weigert enkel door een expliciete is_open = false.
 */
export async function cartTableZoneClosedError(
  supabase: SupabaseLike,
  tenantId: string,
  tableId: string | null | undefined,
): Promise<ReturnType<typeof zoneClosedError>> {
  if (!tableId) return null;
  const { data: tb, error: tbErr } = await supabase.from("dining_tables")
    .select("id, label, area_id")
    .eq("tenant_id", tenantId).eq("id", String(tableId)).maybeSingle();
  if (tbErr || !tb?.area_id) return null;
  const { data: area, error: areaErr } = await supabase.from("dining_areas")
    .select("id, name")
    .eq("tenant_id", tenantId).eq("id", String(tb.area_id)).maybeSingle();
  if (areaErr || !area) return null;
  const isOpen = await areaIsOpen(supabase, tenantId, String(area.id));
  return zoneClosedError({ table_id: String(tb.id), label: String(tb.label ?? ""), area: { id: String(area.id), name: String(area.name), is_open: isOpen } });
}

/**
 * Wat de storefront (of checkout_table) meegeeft → tafel.
 *  - `table_token`: altijd via het zaalplan.
 *  - `table` (vrij nummer): enkel als de winkel géén zaalplan heeft (oud gedrag).
 */
export async function resolveTableInput(
  supabase: SupabaseLike,
  tenantId: string,
  input: { table_token?: unknown; table?: unknown },
): Promise<TableResolution> {
  if (input.table_token !== undefined && input.table_token !== null && String(input.table_token).trim() !== "") {
    return resolveTableToken(supabase, tenantId, String(input.table_token));
  }
  const label = String(input.table ?? "").trim().slice(0, 12);
  if (!FREE_TABLE_RE.test(label)) return { ok: false, code: "VALIDATION_ERROR", message: "Ongeldig tafelnummer" };
  if (await tenantHasFloorPlan(supabase, tenantId)) {
    return { ok: false, code: "TABLE_TOKEN_REQUIRED", message: "Scan de QR-code op je tafel opnieuw" };
  }
  return { ok: true, table: { table_id: null, label, area: null } };
}

/**
 * TAFEL-SESSIE-1 — hangt dit mandje al aan een ándere tafel? Een mandje krijgt zijn tafel bij checkout_table
 * (service_type eat_in + dining_table_id/table_label). Wie daarna met dat mandje voor een andere tafel wil
 * afrekenen of doorgeven, krijgt CART_OTHER_TABLE: de bestelling komt nooit stil op de verkeerde tafel.
 * Enkel voor tafelmandjes (eat_in); een online of afhaalmandje en een mandje zonder tafel: geen fout.
 * Zaalplan-tafel: op dining_table_id; anders (oud vrij nummer, of een mandje van vóór ZAAL-H1) op de naam.
 */
export const CART_OTHER_TABLE = "CART_OTHER_TABLE" as const;
export function cartOtherTableError(
  cart: { service_type?: unknown; table_label?: unknown; dining_table_id?: unknown } | null | undefined,
  table: ResolvedTable,
  /** false = de gebonden tafel bestaat niet meer (verwijderd en opnieuw aangemaakt); onbekend = undefined. */
  boundTableExists?: boolean,
): { code: typeof CART_OTHER_TABLE; message: string } | null {
  if (!cart || cart.service_type !== "eat_in") return null;
  const boundId = cart.dining_table_id ? String(cart.dining_table_id) : null;
  const boundLabel = cart.table_label ? String(cart.table_label) : null;
  let same = true;
  if (boundId) {
    same = !!table.table_id && boundId === table.table_id;
    // Tafel opnieuw aangemaakt (oude id bestaat niet meer) met dezelfde naam: dezelfde tafel voor de gast.
    if (!same && boundTableExists === false && boundLabel === table.label) same = true;
  } else if (boundLabel) same = boundLabel === table.label;
  return same ? null : { code: CART_OTHER_TABLE, message: "Dit mandje hoort bij een andere tafel. Kies je bestelling opnieuw aan deze tafel." };
}
