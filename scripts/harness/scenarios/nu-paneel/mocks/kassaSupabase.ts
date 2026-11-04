// HORECA-NU-1 — de kassa-client: kassa_now_state en de goedkeurders (pos_cashiers).
import { pausedUntil } from './data';
const w = window as unknown as { __writes?: unknown[] };
w.__writes = w.__writes ?? [];
const cashiers = [{ id: 'k1', display_name: 'Els (eigenaar)', role: 'owner' }, { id: 'k2', display_name: 'Jonas (verantwoordelijke)', role: 'manager' }];
function chain(data: unknown): unknown {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'gt', 'not']) q[m] = () => q;
  q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok);
  return q;
}
export const kassaSupabase = {
  from: (table: string) => chain(table === 'pos_cashiers' ? cashiers : []),
  rpc: (fn: string, args: unknown) => {
    w.__writes!.push({ fn, args });
    if (fn === 'kassa_now_state') return chain({ online: true, paused_until: pausedUntil });
    return chain({ ok: true });
  },
};
export const KASSA_AUTH_STORAGE_KEY = 'sb-sellqo-kassa-auth';
export const defaultAuthStorageKey = () => 'sb-gczmfcabnoofnmfpzeop-auth-token';
