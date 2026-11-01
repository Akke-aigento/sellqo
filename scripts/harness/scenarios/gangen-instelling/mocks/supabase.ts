// GANGEN-1: instellingen (gangen aan, Bittergarnituur = voorgerecht) en de categorieën van Café De Wissel. Bewaren lukt lokaal.
type Res = { data: unknown; error: null };
const state = {
  settings: { courses_enabled: true, course_by_category: { bit: 1, hon: 2, wijn: 0 } } as Record<string, unknown>,
  categories: [
    { id: 'tap', name: 'Van de tap' }, { id: 'wijn', name: 'Wijnen' }, { id: 'bit', name: 'Bittergarnituur' },
    { id: 'hon', name: 'Kleine honger' }, { id: 'des', name: 'Desserts' },
  ],
};
function chain(table: string): unknown {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'maybeSingle', 'single']) q[m] = () => q;
  q.upsert = (row: Record<string, unknown>) => { state.settings = { ...state.settings, ...row }; return q; };
  q.then = (ok: (r: Res) => unknown) => Promise.resolve({ data: table === 'categories' ? state.categories : table === 'horeca_pay_settings' ? state.settings : null, error: null }).then(ok);
  return q;
}
export const supabase = { from: (t: string) => chain(t) };
