// ZAAL-H1 — deno test --no-lock --node-modules-dir=none supabase/functions/_shared/diningTables.test.ts
import { deepStrictEqual as assertEquals, rejects as assertRejects } from "node:assert/strict";
import { areaIsOpen, cartOtherTableError, cartTableZoneClosedError, resolveTableInput, resolveTableToken, tenantHasFloorPlan, zoneClosedError } from "./diningTables.ts";

type Row = Record<string, unknown>;
// Kleine nep-databank: thenable builder met select/eq/maybeSingle, zoals supabase-js.
function fakeDb(tables: Record<string, Row[]>, failWith?: { code: string; message: string }) {
  return {
    from(name: string) {
      const filters: [string, unknown][] = [];
      let head = false;
      const run = () => {
        if (failWith) return { data: null, count: null, error: failWith };
        const rows = (tables[name] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
        return { data: head ? null : rows, count: rows.length, error: null };
      };
      const b = {
        select(_cols: string, opts?: { head?: boolean }) { head = !!opts?.head; return b; },
        eq(k: string, v: unknown) { filters.push([k, v]); return b; },
        maybeSingle() { const r = run(); return Promise.resolve({ data: (r.data as Row[] | null)?.[0] ?? null, error: r.error }); },
        then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return Promise.resolve(run()).then(res, rej); },
      };
      return b;
    },
  };
}

const T = "t1";
const TOKEN = "a1b2c3d4e5f6a1b2c3d4e5f6";
const db = fakeDb({
  dining_areas: [{ id: "a1", tenant_id: T, name: "Terras", is_active: true }, { id: "a2", tenant_id: T, name: "Weg", is_active: false }],
  dining_tables: [
    { id: "tb1", tenant_id: T, area_id: "a1", label: "Ter-1", is_active: true, qr_token: TOKEN },
    { id: "tb2", tenant_id: T, area_id: "a2", label: "X", is_active: true, qr_token: "b".repeat(24) },
    { id: "tb3", tenant_id: T, area_id: "a1", label: "Oud", is_active: false, qr_token: "c".repeat(24) },
  ],
});

Deno.test("token → tafel met ruimte", async () => {
  assertEquals(await resolveTableToken(db, T, TOKEN.toUpperCase()), { ok: true, table: { table_id: "tb1", label: "Ter-1", area: { id: "a1", name: "Terras", is_open: true } } });
});

Deno.test("token van andere winkel, verwijderde tafel of verwijderde ruimte: niet gevonden", async () => {
  assertEquals((await resolveTableToken(db, "t2", TOKEN)).ok, false);
  assertEquals((await resolveTableToken(db, T, "c".repeat(24))).ok, false);
  assertEquals((await resolveTableToken(db, T, "b".repeat(24))).ok, false);
  assertEquals((await resolveTableToken(db, T, "4")).ok, false);
});

Deno.test("vrij tafelnummer: enkel zonder zaalplan", async () => {
  assertEquals(await resolveTableInput(db, T, { table: "4" }), { ok: false, code: "TABLE_TOKEN_REQUIRED", message: "Scan de QR-code op je tafel opnieuw" });
  const empty = fakeDb({ dining_tables: [] });
  assertEquals(await resolveTableInput(empty, T, { table: "4" }), { ok: true, table: { table_id: null, label: "4", area: null } });
  assertEquals((await resolveTableInput(empty, T, { table: "<x>" })).ok, false);
});

Deno.test("tabel bestaat nog niet (vóór migratie): oud gedrag; andere fout: geen stille terugval", async () => {
  assertEquals(await tenantHasFloorPlan(fakeDb({}, { code: "PGRST205", message: "not found" }), T), false);
  await assertRejects(() => tenantHasFloorPlan(fakeDb({}, { code: "57014", message: "timeout" }), T));
});

// HORECA-NU-2a — zone open of dicht.
Deno.test("dichte zone: tafel blijft gevonden, met is_open false en een nette fout", async () => {
  const closed = fakeDb({
    dining_areas: [{ id: "a1", tenant_id: T, name: "Terras", is_active: true, is_open: false }],
    dining_tables: [{ id: "tb1", tenant_id: T, area_id: "a1", label: "Ter-1", is_active: true, qr_token: TOKEN }],
  });
  const r = await resolveTableToken(closed, T, TOKEN);
  assertEquals(r, { ok: true, table: { table_id: "tb1", label: "Ter-1", area: { id: "a1", name: "Terras", is_open: false } } });
  if (!r.ok) throw new Error("onmogelijk");
  assertEquals(zoneClosedError(r.table), { code: "ZONE_CLOSED", message: "Terras is momenteel gesloten. Bestellen of de bediening roepen kan hier nu niet." });
});

Deno.test("open zone, vrij nummer of kolom nog niet gemigreerd: nooit ZONE_CLOSED", async () => {
  const r = await resolveTableToken(db, T, TOKEN);
  if (!r.ok) throw new Error("tafel");
  assertEquals(zoneClosedError(r.table), null);
  assertEquals(zoneClosedError({ table_id: null, label: "4", area: null }), null);
  // 42703 (kolom bestaat niet) of een andere leesfout: open, zoals vroeger.
  assertEquals(await areaIsOpen(fakeDb({}, { code: "42703", message: "column does not exist" }), T, "a1"), true);
  assertEquals(await areaIsOpen(fakeDb({ dining_areas: [] }), T, "a1"), true);
});

// HORECA-NU-1b — tafel die al op het mandje staat: zone opnieuw nakijken vlak vóór checkout_complete.
Deno.test("mandje met tafel: dichte zone → ZONE_CLOSED; open, onbekend, andere winkel of leesfout → null", async () => {
  const closed = fakeDb({
    dining_areas: [{ id: "a1", tenant_id: T, name: "Terras", is_active: true, is_open: false }],
    dining_tables: [{ id: "tb1", tenant_id: T, area_id: "a1", label: "Ter-1", is_active: true, qr_token: TOKEN }],
  });
  assertEquals(await cartTableZoneClosedError(closed, T, "tb1"), { code: "ZONE_CLOSED", message: "Terras is momenteel gesloten. Bestellen of de bediening roepen kan hier nu niet." });
  // Tafel van een andere winkel: niet gevonden (tenant-filter) → geen oordeel.
  assertEquals(await cartTableZoneClosedError(closed, "t2", "tb1"), null);
  assertEquals(await cartTableZoneClosedError(closed, T, "bestaat-niet"), null);
  assertEquals(await cartTableZoneClosedError(closed, T, null), null);
  assertEquals(await cartTableZoneClosedError(db, T, "tb1"), null);
  assertEquals(await cartTableZoneClosedError(fakeDb({}, { code: "42703", message: "column does not exist" }), T, "tb1"), null);
});

Deno.test("TAFEL-SESSIE-1: mandje van een andere tafel → CART_OTHER_TABLE; zelfde tafel, geen tafel of online → null", () => {
  const t1 = { table_id: "tb1", label: "Blauw 1", area: null };
  const t2 = { table_id: "tb2", label: "Blauw 2", area: null };
  const free4 = { table_id: null, label: "4", area: null };
  // Zaalplan: op het tafel-id (ook als twee tafels dezelfde naam hebben).
  assertEquals(cartOtherTableError({ service_type: "eat_in", table_label: "Blauw 1", dining_table_id: "tb1" }, t1), null);
  assertEquals(cartOtherTableError({ service_type: "eat_in", table_label: "Blauw 1", dining_table_id: "tb1" }, t2)?.code, "CART_OTHER_TABLE");
  assertEquals(cartOtherTableError({ service_type: "eat_in", table_label: "X", dining_table_id: "tb1" }, { ...t2, label: "X" })?.code, "CART_OTHER_TABLE");
  // Zaalplan-mandje naar een vrij nummer: nooit dezelfde tafel.
  assertEquals(cartOtherTableError({ service_type: "eat_in", table_label: "4", dining_table_id: "tb1" }, free4)?.code, "CART_OTHER_TABLE");
  // Vrij nummer (of mandje van vóór ZAAL-H1): op de naam.
  assertEquals(cartOtherTableError({ service_type: "eat_in", table_label: "4", dining_table_id: null }, free4), null);
  assertEquals(cartOtherTableError({ service_type: "eat_in", table_label: "5" }, free4)?.code, "CART_OTHER_TABLE");
  // Nog geen tafel op het mandje, of geen tafelmandje: niets weigeren (eerste checkout_table, online, afhalen).
  assertEquals(cartOtherTableError({ service_type: null, table_label: null, dining_table_id: null }, t1), null);
  assertEquals(cartOtherTableError({ service_type: "eat_in", table_label: null, dining_table_id: null }, t1), null);
  assertEquals(cartOtherTableError({ service_type: "pickup", table_label: "Blauw 2", dining_table_id: "tb2" }, t1), null);
  assertEquals(cartOtherTableError(null, t1), null);
});

Deno.test("TAFEL-SESSIE-1: gebonden tafel bestaat niet meer en de naam klopt → geen fout; andere naam of bestaat nog → fout", () => {
  const t9 = { table_id: "tb9", label: "Blauw 1", area: null };
  const cart = { service_type: "eat_in", table_label: "Blauw 1", dining_table_id: "tb1" };
  assertEquals(cartOtherTableError(cart, t9, false), null);
  assertEquals(cartOtherTableError(cart, t9, true)?.code, "CART_OTHER_TABLE");
  assertEquals(cartOtherTableError(cart, t9)?.code, "CART_OTHER_TABLE");
  assertEquals(cartOtherTableError(cart, { ...t9, label: "Blauw 2" }, false)?.code, "CART_OTHER_TABLE");
});
