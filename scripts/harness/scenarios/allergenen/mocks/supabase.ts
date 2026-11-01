// Harnas allergenen: per kaart een rij uit window.__rows (id → rij); bewaren wordt gelogd.
const w = window as unknown as { __rows: Record<string, Record<string, unknown>>; __updates: unknown[] };
w.__updates = [];
export const supabase = {
  from: () => {
    let id = '';
    return {
      select: () => ({ eq: (_c: string, v: string) => { id = v; return { single: async () => ({ data: w.__rows[id], error: null }) }; } }),
      update: (patch: Record<string, unknown>) => ({ eq: async (_c: string, v: string) => { w.__updates.push({ id: v, patch }); w.__rows[v] = { ...w.__rows[v], ...patch }; return { error: null }; } }),
    };
  },
};
