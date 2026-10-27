/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// BILLING-SAFE-1 / INVOICE-INTEGRITY-1 — nep-databank die updates, inserts, upserts en deletes
// écht uitvoert (anders dan fakeSupabase.ts, die schrijfacties enkel logt). Met barrières
// (Gate) om gelijktijdige leveringen na te spelen, eigen RPC's en een opslag-stub.
export type Row = Record<string, any>;


function matchesContains(value: any, wanted: any): boolean {
  if (Array.isArray(wanted)) return Array.isArray(value) && wanted.every((x) => value.includes(x));
  if (!value || typeof value !== "object") return false;
  return Object.entries(wanted).every(([k, v]) => JSON.stringify(value[k]) === JSON.stringify(v));
}

class Q {
  private filters: ((r: Row) => boolean)[] = [];
  private op: "select" | "update" | "insert" | "upsert" | "delete" = "select";
  private patch: Row | null = null;
  private rows: Row[] = [];
  private returning = false;
  private singleMode: "one" | "maybe" | null = null;
  private lim: number | null = null;
  private head = false;
  private counting = false;
  constructor(private db: StatefulDb, private table: string) {}
  select(_c?: string, o?: { count?: string; head?: boolean }) {
    if (this.op !== "select") this.returning = true;
    if (o?.count) this.counting = true;
    if (o?.head) this.head = true;
    return this;
  }
  update(p: Row) { this.op = "update"; this.patch = p; return this; }
  insert(r: Row | Row[]) { this.op = "insert"; this.rows = Array.isArray(r) ? r : [r]; return this; }
  // Enkel de vorm die de code gebruikt: onConflict "id", ignoreDuplicates (ON CONFLICT DO NOTHING).
  upsert(r: Row | Row[], o?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    if (o?.onConflict !== "id" || !o.ignoreDuplicates) throw new Error("upsert-vorm niet ondersteund");
    this.op = "upsert"; this.rows = Array.isArray(r) ? r : [r]; return this;
  }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: any) {
    const [col, key] = c.split("->>");
    this.filters.push((r) => String(key ? r[col]?.[key] : r[col]) === String(v));
    return this;
  }
  neq(c: string, v: any) { this.filters.push((r) => String(r[c]) !== String(v)); return this; }
  in(c: string, vs: any[]) { const s = new Set(vs.map(String)); this.filters.push((r) => s.has(String(r[c]))); return this; }
  gte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] >= v); return this; }
  lte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] <= v); return this; }
  is(c: string, v: any) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  not(c: string, op: string, v: any) {
    if (op === "in") {
      const s = new Set(String(v).replace(/[()]/g, "").split(",").map((x) => x.trim()));
      this.filters.push((r) => !s.has(String(r[c])));
    } else if (op === "is" && v === null) {
      this.filters.push((r) => r[c] != null);
    } else throw new Error(`not(${op}) niet ondersteund`);
    return this;
  }
  contains(c: string, v: any) { this.filters.push((r) => matchesContains(r[c], v)); return this; }
  private sorts: { col: string; asc: boolean }[] = [];
  private rangeFrom = 0;
  order(col?: string, o?: { ascending?: boolean }) { if (col) this.sorts.push({ col, asc: o?.ascending !== false }); return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.lim = to - from + 1; return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }
  single() { this.singleMode = "one"; return this; }
  // deno-lint-ignore no-explicit-any
  then(res: (v: any) => any, rej?: (e: any) => any) { return Promise.resolve(this.run()).then(res, rej); }
  private async run() {
    // Barrière: laat N gelijktijdige aanroepen op dezelfde plek op elkaar wachten.
    const gate = this.db.gates[`${this.table}:${this.op}${this.head ? ":head" : ""}`];
    if (gate) await gate.arrive();
    this.db.calls[`${this.table}:${this.op}`] = (this.db.calls[`${this.table}:${this.op}`] ?? 0) + 1;
    const failure = this.db.fail[`${this.table}:${this.op}`];
    if (failure) return { data: null, error: { message: failure }, count: null };
    const table = (this.db.tables[this.table] ||= []);
    if (this.op === "upsert") {
      const ids = new Set(table.map((r) => r.id));
      for (const r of this.rows) if (!ids.has(r.id)) table.push(structuredClone(r));
      return { data: null, error: null };
    }
    if (this.op === "delete") {
      const keep = table.filter((r) => !this.filters.every((f) => f(r)));
      this.db.tables[this.table] = keep;
      return { data: null, error: null };
    }
    if (this.op === "insert") {
      const added = this.rows.map((r) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...structuredClone(r) }));
      table.push(...added);
      const out = added.map((r) => structuredClone(r));
      return { data: this.singleMode ? out[0] : this.returning ? out : null, error: null };
    }
    const hit = table.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "update") {
      for (const r of hit) Object.assign(r, structuredClone(this.patch));
      return { data: this.returning ? hit.map((r) => structuredClone(r)) : null, error: null };
    }
    if (this.head) return { data: null, error: null, count: hit.length };
    const sorted = [...hit].sort((a, b) => {
      for (const s of this.sorts) {
        const x = a[s.col], y = b[s.col];
        if (x === y) continue;
        return (x > y ? 1 : -1) * (s.asc ? 1 : -1);
      }
      return 0;
    });
    const sliced = this.lim != null ? sorted.slice(this.rangeFrom, this.rangeFrom + this.lim) : sorted.slice(this.rangeFrom);
    const out = sliced.map((r) => structuredClone(r));
    if (this.singleMode) return { data: out[0] ?? null, error: null };
    return { data: out, error: null, count: this.counting ? hit.length : null };
  }
}

export class Gate {
  private waiting: (() => void)[] = [];
  constructor(private n: number) {}
  arrive(): Promise<void> {
    return new Promise((res) => {
      this.waiting.push(res);
      if (this.waiting.length >= this.n) this.waiting.splice(0).forEach((f) => f());
    });
  }
}

export class StatefulDb {
  fail: Record<string, string> = {};
  gates: Record<string, Gate> = {};
  calls: Record<string, number> = {};
  invoked: { name: string; body: any }[] = [];
  private seq = 0;
  constructor(public tables: Record<string, Row[]>) {}
  from(t: string) { return new Q(this, t); }
  /** Eigen RPC-implementaties per test (bv. create_invoice_with_lines). */
  rpcs: Record<string, (args: any, db: StatefulDb) => { data: any; error: any }> = {};
  rpc(fn: string, args?: any) {
    this.seq += 1;
    if (this.rpcs[fn]) return Promise.resolve(this.rpcs[fn](args, this));
    if (fn === "generate_payment_request_number") return Promise.resolve({ data: `PR-2026-00${10 + this.seq}`, error: null });
    if (fn === "generate_invoice_number") return Promise.resolve({ data: `INV-2026-0${200 + this.seq}`, error: null });
    return Promise.resolve({ data: null, error: null });
  }
  /** Opslag: geüploade bestanden als tekst of bytes, per pad. */
  uploads: Record<string, Uint8Array | string> = {};
  storage = {
    from: (_bucket: string) => ({
      upload: async (path: string, body: Blob | Uint8Array | string) => {
        this.uploads[path] = body instanceof Blob ? await body.text() : body;
        return { data: { path }, error: null };
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }),
    }),
  };
  functions = {
    invoke: (name: string, opts?: { body?: any }) => {
      this.invoked.push({ name, body: opts?.body });
      return Promise.resolve({ data: { success: true }, error: null });
    },
  };
  notifications(type?: string) {
    return (this.tables.notifications ?? []).filter((n) => !type || n.type === type);
  }
}

