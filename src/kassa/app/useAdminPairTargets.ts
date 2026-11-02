// KASSA-MOBIEL-1 — waar dit toestel met één tik aan kan hangen: is er op dit toestel een beheer-sessie met de rol
// tenant_admin, dan de kassa's (pos_terminals, zonder de virtuele "Online (QR)") van die zaken. Gelezen met de
// beheer-client (RLS van beheer, zoals Kassa (POS) › Kassa's). Niets in beheer = lege lijst = geen knop.
import { useEffect, useState } from 'react';
import { supabase as beheerSupabase } from '@/integrations/supabase/client';
import { useOptionalAuth } from '@/hooks/useAuth';

export interface PairTarget {
  tenantId: string;
  tenantName: string;
  terminals: { id: string; name: string }[];
}

export function adminTenantIds(roles: { role: string; tenant_id: string | null }[] | undefined): string[] {
  return [...new Set((roles ?? []).filter((r) => r.role === 'tenant_admin' && r.tenant_id).map((r) => r.tenant_id as string))];
}

export function useAdminPairTargets(): { email: string | null; targets: PairTarget[]; loading: boolean } {
  const auth = useOptionalAuth();
  const ids = adminTenantIds(auth?.roles);
  const key = ids.sort().join(',');
  const [targets, setTargets] = useState<PairTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const waiting = !!auth && (auth.loading || (!!auth.user && auth.rolesLoading));

  useEffect(() => {
    if (!key) { setTargets([]); return; }
    let alive = true;
    setLoading(true);
    const tenantIds = key.split(',');
    void (async () => {
      try {
        const [t, p] = await Promise.all([
          beheerSupabase.from('tenants').select('id, name').in('id', tenantIds),
          beheerSupabase.from('pos_terminals').select('id, name, tenant_id').in('tenant_id', tenantIds)
            // REKENING-ONLINE-1: de kassa "Online (QR)" is geen toestel.
            .is('settings->>virtual' as never, null).order('name'),
        ]);
        if (!alive) return;
        const names = new Map(((t.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name]));
        const list = tenantIds
          .map((id) => ({
            tenantId: id,
            tenantName: names.get(id) ?? '',
            terminals: ((p.data ?? []) as { id: string; name: string; tenant_id: string }[])
              .filter((x) => x.tenant_id === id).map((x) => ({ id: x.id, name: x.name })),
          }))
          .filter((x) => x.terminals.length > 0)
          .sort((a, b) => a.tenantName.localeCompare(b.tenantName));
        setTargets(list);
      } catch {
        if (alive) setTargets([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [key]);

  return { email: auth?.user?.email ?? null, targets: key ? targets : [], loading: waiting || loading };
}
