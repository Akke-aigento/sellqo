/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// Minimal in-memory Supabase client for the PROMO-ENGINE-1 comparison test.
// Supports the query shapes used by computeCartTotals / validateDiscountCode /
// computeCartPromotions: select (pre-joined rows), eq, in, gt, ilike, order, limit,
// maybeSingle, single, count/head, update (logged, no-op), rpc (no-op).
type Row = Record<string, any>;

function unescapeLike(p: string) { return p.replace(/\\([%_\\])/g, '$1'); }

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private lim: number | null = null;
  private rangeFrom = 0;
  private head = false;
  private countMode = false;
  private singleMode: 'maybe' | 'one' | null = null;
  private isUpdate = false;
  // SUB-UNIFY-2A: update(...).select(...) geeft de geraakte rijen terug (zoals PostgREST).
  private returning = false;
  constructor(private db: FakeDb, private table: string) {}
  select(_cols?: string, opts?: { count?: string; head?: boolean }) { if (this.isUpdate) this.returning = true; if (opts?.count) this.countMode = true; if (opts?.head) this.head = true; return this; }
  private write: Row | null = null;
  update(patch: Row) { this.isUpdate = true; this.write = { table: this.table, patch, where: {} }; this.db.writes.push(this.write); return this; }
  // MAIL-3: met `persistInserts` komen ingevoegde rijen echt in de tabel (met een id), en geeft
  // insert(...).select().single() de nieuwe rij terug. Zonder die optie: enkel gelogd, zoals altijd.
  private inserted: Row[] | null = null;
  insert(rows: any) {
    this.db.writes.push({ table: this.table, insert: rows });
    if (this.db.persistInserts) {
      const list = (Array.isArray(rows) ? rows : [rows]).map((r: Row) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...r }));
      (this.db.tables[this.table] ||= []).push(...list);
      this.inserted = list;
    }
    return this;
  }
  // BILL-ADDON-1: delete wordt gelogd (net als update), niet uitgevoerd.
  delete() { this.isUpdate = true; this.write = { table: this.table, delete: true, where: {} }; this.db.writes.push(this.write); return this; }
  eq(c: string, v: any) { if (this.write) this.write.where[c] = v; this.filters.push((r) => String(r[c]) === String(v)); return this; }
  neq(c: string, v: any) { this.filters.push((r) => String(r[c]) !== String(v)); return this; }
  in(c: string, vs: any[]) { const s = new Set(vs.map(String)); this.filters.push((r) => s.has(String(r[c]))); return this; }
  gt(c: string, v: any) { this.filters.push((r) => r[c] != null && (typeof v === 'number' ? Number(r[c]) > v : String(r[c]) > String(v))); return this; }
  ilike(c: string, p: string) {
    if (/(^|[^\\])[%_]/.test(p)) {
      const re = new RegExp('^' + p.split('%').map((x) => unescapeLike(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');
      this.filters.push((r) => r[c] != null && re.test(String(r[c])));
    } else {
      const t = unescapeLike(p).toLowerCase();
      this.filters.push((r) => r[c] != null && String(r[c]).toLowerCase() === t);
    }
    return this;
  }
  gte(c: string, v: any) { this.filters.push((r) => r[c] != null && Number(r[c]) >= Number(v)); return this; }
  lte(c: string, v: any) { this.filters.push((r) => r[c] != null && Number(r[c]) <= Number(v)); return this; }
  contains(c: string, vs: any[]) { this.filters.push((r) => Array.isArray(r[c]) && vs.every((x: any) => r[c].includes(x))); return this; }
  overlaps(c: string, vs: any[]) { this.filters.push((r) => Array.isArray(r[c]) && r[c].some((x: any) => vs.includes(x))); return this; }
  not() { return this; }
  // Alleen de vorm die storefront-api gebruikt: "a.eq.X,b.in.(x,y)".
  or(expr: string) {
    const parts = expr.match(/[^,(]+(\([^)]*\))?/g) || [];
    const tests = parts.map((part) => {
      const m = part.match(/^(\w+)\.(eq|in)\.(.*)$/);
      if (!m) return () => false;
      const [, col, op, val] = m;
      if (op === 'eq') return (r: Row) => String(r[col]) === val;
      const set = new Set(val.replace(/^\(|\)$/g, '').split(','));
      return (r: Row) => set.has(String(r[col]));
    });
    this.filters.push((r) => tests.some((t) => t(r)));
    return this;
  }
  range(from: number, to: number) { this.rangeFrom = from; this.lim = to - from + 1; return this; }
  order() { return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }
  single() { this.singleMode = 'one'; return this; }
  is(c: string, v: any) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  // deno-lint-ignore no-explicit-any
  then(res: (v: any) => any, rej?: (e: any) => any) { return Promise.resolve(this.run()).then(res, rej); }
  private run() {
    if (this.inserted) {
      const rows = this.inserted.map((r) => structuredClone(r));
      return { data: this.singleMode ? rows[0] ?? null : rows, error: null };
    }
    if (this.isUpdate) {
      if (!this.returning) return { data: null, error: null };
      return { data: (this.db.tables[this.table] || []).filter((r) => this.filters.every((f) => f(r))).map((r) => structuredClone(r)), error: null };
    }
    let rows = (this.db.tables[this.table] || []).filter((r) => this.filters.every((f) => f(r)));
    const count = rows.length;
    if (this.rangeFrom || this.lim != null) rows = rows.slice(this.rangeFrom, this.lim != null ? this.rangeFrom + this.lim : undefined);
    if (this.head) return { data: null, error: null, count };
    if (this.singleMode) return { data: rows[0] ?? null, error: null, count: this.countMode ? count : null };
    return { data: rows.map((r) => structuredClone(r)), error: null, count: this.countMode ? count : null };
  }
}

export class FakeDb {
  writes: Row[] = [];
  constructor(public tables: Record<string, Row[]>, public persistInserts = false) {}
  from(t: string) { return new Query(this, t); }
  rpc() { return Promise.resolve({ data: null, error: null }); }
}
