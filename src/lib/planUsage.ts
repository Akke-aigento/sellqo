// LIMITS-1 — hoe SellQo het gebruik telt, gelijk aan de databank (enforce_plan_limit,
// platform_month_paid_orders). Eén plek voor de banner, de billingpagina en enforceLimit.
//  - producten: zonder tickets (tickets betalen per stuk en tellen nooit mee);
//  - orders: betaalde orders zonder tickets, bedrag > 0, deze kalendermaand (Brussel), sinds de
//    overstap naar het huidige plan (platform_month_paid_orders);
//  - gebruikers: unieke personen in het team, zonder platformbeheerders (platform_team_size);
//  - klanten: geen limiet meer, alleen nog ter info.
import { supabase } from '@/integrations/supabase/client';

export type UsageKind = 'products' | 'orders' | 'customers' | 'users';

export async function countUsage(tenantId: string, kind: UsageKind): Promise<number> {
  switch (kind) {
    case 'products': {
      const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        // Zoals de databank: coalesce(product_type, '') <> 'ticket' (neq alleen laat NULL vallen).
        .or('product_type.is.null,product_type.neq.ticket');
      return count || 0;
    }
    case 'orders': {
      const { data } = await supabase.rpc('platform_month_paid_orders' as never, { p_tenant_id: tenantId } as never);
      return Number(data ?? 0);
    }
    case 'customers': {
      const { count } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      return count || 0;
    }
    case 'users': {
      // Zelfde functie als de databanktrigger: unieke personen, zonder platformbeheerders.
      const { data } = await supabase.rpc('platform_team_size' as never, { p_tenant_id: tenantId } as never);
      return Number(data ?? 0);
    }
  }
}

/** Banner- en meldingsdrempels (zelfde als notify_plan_usage). */
export function usageLevel(current: number, limit: number | null | undefined): 'ok' | 'near' | 'full' {
  if (limit == null || limit <= 0) return 'ok';
  if (current >= limit) return 'full';
  if (current * 100 >= limit * 80) return 'near';
  return 'ok';
}

/**
 * Databankfout van enforce_plan_limit ("PLAN_LIMIT_PRODUCTS: …") → nette tekst, of null
 * als het geen limietfout is. Voor toasts bij aanmaken, dupliceren en uitnodigen.
 */
export function planLimitMessage(error: unknown, t: (key: string) => string): string | null {
  const msg = String((error as { message?: unknown } | null)?.message ?? error ?? '');
  const m = msg.match(/PLAN_LIMIT_(PRODUCTS|USERS)/);
  if (!m) return null;
  return t(m[1] === 'PRODUCTS' ? 'billing.limit_error.products' : 'billing.limit_error.users');
}
