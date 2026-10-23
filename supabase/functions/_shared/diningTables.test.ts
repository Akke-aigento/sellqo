// ZAAL-H1 — deno test --no-lock --node-modules-dir=none supabase/functions/_shared/diningTables.test.ts
import { deepStrictEqual as assertEquals, rejects as assertRejects } from "node:assert/strict";
import { resolveTableInput, resolveTableToken, tenantHasFloorPlan } from "./diningTables.ts";

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
  assertEquals(await resolveTableToken(db, T, TOKEN.toUpperCase()), { ok: true, table: { table_id: "tb1", label: "Ter-1", area: { id: "a1", name: "Terras" } } });
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
