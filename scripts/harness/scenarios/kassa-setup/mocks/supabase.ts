// Minimale querybuilder: select-ketens geven de terminals uit window.__harness, insert geeft een nieuw id.
import { H } from './h';
type Res = { data: unknown; error: { message: string } | null };
function chain(res: () => Res) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is', 'order', 'insert', 'single', 'maybeSingle']) q[m] = () => q;
  q.then = (ok: (r: Res) => unknown) => Promise.resolve(res()).then(ok);
  return q;
}
export const supabase = {
  from: () => ({
    select: () => chain(() => ({ data: H.terminals ?? [], error: null })),
    insert: (row: { name: string }) => chain(() => {
      (window as unknown as { __inserted?: unknown }).__inserted = row;
      return H.insertError ? { data: null, error: { message: H.insertError } } : { data: { id: 'nieuw-1' }, error: null };
    }),
  }),
};
