// Ketenbare stub: elke methode geeft dezelfde ketting terug; awaiten geeft de varianten.
import { variants } from './data';
function chain(): unknown {
  const target = () => {};
  return new Proxy(target, {
    get(_t, prop) {
      if (prop === 'then') return (res: (v: unknown) => void) => res({ data: variants, error: null, count: 0 });
      return () => chain();
    },
    apply() { return chain(); },
  });
}
export const supabase = { from: () => chain(), rpc: async () => ({ data: null, error: null }), storage: { from: () => chain() }, auth: { getUser: async () => ({ data: { user: null } }) } };
