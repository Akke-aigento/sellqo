// KASSA-ACCOUNT-1 — nep-Supabase: koppelcode 482913 werkt, al de rest = 404; beheer maakt een code en ontkoppelt.
const w = window as unknown as { __calls: unknown[] };
w.__calls = [];
const TOKEN = 'ab'.repeat(32);
export const supabase = {
  functions: {
    invoke: async (name: string, opts: { body: Record<string, unknown> }) => {
      w.__calls.push({ name, body: opts.body });
      if (name === 'kassa-device-pair') {
        if (opts.body.code === '482913' || opts.body.code === TOKEN) return { data: { ok: true, email: 'kassa-x@toestel.sellqo.app', password: 'x'.repeat(48) }, error: null };
        if (opts.body.code === '222222') return { data: null, error: { context: new Response(JSON.stringify({ error: 'device_already_paired' }), { status: 409 }) } };
        if (opts.body.code === '111111') return { data: null, error: { context: new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }) } };
        return { data: null, error: { context: new Response(JSON.stringify({ error: 'invalid_code' }), { status: 404 }) } };
      }
      if (name === 'kassa-device-revoke') return { data: { ok: true, revoked: true, banned: true }, error: null };
      return { data: null, error: { message: 'onbekend' } };
    },
  },
  auth: { signInWithPassword: async (c: unknown) => { w.__calls.push({ name: 'signIn', body: c }); return { data: {}, error: null }; } },
  // KASSA-MOBIEL-1: zaken en kassa's van de eigenaar (useAdminPairTargets, beheer-client).
  from: (table: string) => {
    const rows: Record<string, unknown[]> = {
      tenants: [{ id: 'tn', name: 'Café De Wissel' }, { id: 'tn2', name: 'Eetcafé Het Hoekje' }],
      pos_terminals: [{ id: 't1', name: 'Kassa 1', tenant_id: 'tn' }, { id: 't3', name: 'Terras', tenant_id: 'tn' }, { id: 't9', name: 'Toog', tenant_id: 'tn2' }],
    };
    const q = { select: () => q, in: () => q, is: () => q, order: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(r) };
    return q;
  },
  rpc: async (name: string, args: unknown) => {
    w.__calls.push({ name, body: args, client: 'beheer' } as never);
    if (name === 'kassa_pair_code_create') return { data: { code: '482913', token: TOKEN, expires_at: new Date(Date.now() + 600_000).toISOString(), terminal_name: 'Kassa 1' }, error: null };
    return { data: null, error: null };
  },
};
