import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export type RFMSegment = 
  | 'champions' | 'loyal' | 'potential_loyal' | 'new_customers'
  | 'promising' | 'needs_attention' | 'about_to_sleep'
  | 'at_risk' | 'cant_lose' | 'hibernating' | 'lost';

export interface CustomerRFM {
  id: string;
  name: string;
  email: string;
  recency_score: number; // 1-5
  frequency_score: number; // 1-5
  monetary_score: number; // 1-5
  rfm_score: number; // composite
  segment: RFMSegment;
  days_since_last_order: number | null;
  total_orders: number;
  total_spent: number;
  clv_predicted: number;
  churn_risk: 'low' | 'medium' | 'high' | 'critical';
  email_engagement_score: number | null;
}

export interface RFMDistribution {
  segment: RFMSegment;
  label: string;
  count: number;
  revenue: number;
  color: string;
  description: string;
}

const SEGMENT_META: Record<RFMSegment, { label: string; color: string; description: string }> = {
  champions: { label: 'Champions', color: '#22c55e', description: 'Beste klanten — kopen vaak en recent' },
  loyal: { label: 'Loyale klanten', color: '#3b82f6', description: 'Trouwe kopers met hoge frequentie' },
  potential_loyal: { label: 'Potentieel loyaal', color: '#06b6d4', description: 'Recente kopers die loyaal kunnen worden' },
  new_customers: { label: 'Nieuwe klanten', color: '#8b5cf6', description: 'Recent geregistreerd, eerste aankopen' },
  promising: { label: 'Veelbelovend', color: '#a855f7', description: 'Recente kopers met potentie' },
  needs_attention: { label: 'Aandacht nodig', color: '#f59e0b', description: 'Bovengemiddeld maar afnemend' },
  about_to_sleep: { label: 'Dreigt in te slapen', color: '#f97316', description: 'Onder gemiddelde activiteit' },
  at_risk: { label: 'Risico', color: '#ef4444', description: 'Waren goede klanten, nu inactief' },
  cant_lose: { label: 'Mag je niet verliezen', color: '#dc2626', description: 'Hoge waarde maar lang niet gekocht' },
  hibernating: { label: 'Slapend', color: '#6b7280', description: 'Lange tijd inactief' },
  lost: { label: 'Verloren', color: '#9ca3af', description: 'Zeer lang inactief, lage waarde' },
};

function classifyRFMSegment(r: number, f: number, m: number): RFMSegment {
  if (r >= 4 && f >= 4 && m >= 4) return 'champions';
  if (r >= 3 && f >= 4) return 'loyal';
  if (r >= 4 && f >= 2 && m >= 2) return 'potential_loyal';
  if (r >= 4 && f <= 2) return 'new_customers';
  if (r >= 3 && f >= 2) return 'promising';
  if (r >= 3 && f >= 3 && m >= 3) return 'needs_attention';
  if (r === 2 && f >= 2) return 'about_to_sleep';
  if (r <= 2 && f >= 3 && m >= 3) return 'at_risk';
  if (r <= 2 && f >= 4 && m >= 4) return 'cant_lose';
  if (r <= 2 && f <= 2) return 'hibernating';
  return 'lost';
}

function scoreQuintile(value: number, values: number[]): number {
  if (values.length === 0) return 3;
  const sorted = [...values].sort((a, b) => a - b);
  const p20 = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
  const p40 = sorted[Math.floor(sorted.length * 0.4)] ?? 0;
  const p60 = sorted[Math.floor(sorted.length * 0.6)] ?? 0;
  const p80 = sorted[Math.floor(sorted.length * 0.8)] ?? 0;
  if (value <= p20) return 1;
  if (value <= p40) return 2;
  if (value <= p60) return 3;
  if (value <= p80) return 4;
  return 5;
}

function predictCLV(totalSpent: number, totalOrders: number, daysSinceFirst: number): number {
  if (totalOrders === 0 || daysSinceFirst <= 0) return 0;
  const avgOrderValue = totalSpent / totalOrders;
  const orderFrequency = totalOrders / (daysSinceFirst / 365);
  // Simple CLV: AOV × frequency × expected lifespan (2 years)
  return Math.round(avgOrderValue * orderFrequency * 2);
}

function assessChurnRisk(daysSinceLastOrder: number | null, emailEngagement: number | null): 'low' | 'medium' | 'high' | 'critical' {
  if (daysSinceLastOrder === null) return 'medium';
  const engagement = emailEngagement ?? 50;
  if (daysSinceLastOrder > 180 || (daysSinceLastOrder > 90 && engagement < 20)) return 'critical';
  if (daysSinceLastOrder > 90 || (daysSinceLastOrder > 60 && engagement < 30)) return 'high';
  if (daysSinceLastOrder > 45 || engagement < 40) return 'medium';
  return 'low';
}

export function useCustomerIntelligence() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['customer-intelligence', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      // Fetch customers with their latest order date
      const { data: customers, error: custErr } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, total_orders, total_spent, email_engagement_score, created_at')
        .eq('tenant_id', currentTenant.id);

      if (custErr) throw custErr;
      if (!customers || customers.length === 0) return { customers: [], distribution: [], stats: { total: 0, atRisk: 0, avgCLV: 0, churnRate: 0 } };

      // Fetch most recent order per customer
      const { data: recentOrders, error: ordErr } = await supabase
        .from('orders')
        .select('customer_id, created_at')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (ordErr) throw ordErr;

      const latestOrderMap = new Map<string, string>();
      const firstOrderMap = new Map<string, string>();
      for (const o of recentOrders ?? []) {
        if (o.customer_id && !latestOrderMap.has(o.customer_id)) {
          latestOrderMap.set(o.customer_id, o.created_at);
        }
        if (o.customer_id) {
          firstOrderMap.set(o.customer_id, o.created_at); // last iteration = earliest
        }
      }

      const now = Date.now();
      const daysSinceValues: number[] = [];
      const frequencyValues: number[] = [];
      const monetaryValues: number[] = [];

      // Pre-compute raw values
      const rawData = customers.map(c => {
        const lastOrder = latestOrderMap.get(c.id);
        const daysSince = lastOrder ? Math.floor((now - new Date(lastOrder).getTime()) / 86400000) : 999;
        const orders = c.total_orders ?? 0;
        const spent = Number(c.total_spent ?? 0);

        if (orders > 0) {
          daysSinceValues.push(daysSince);
          frequencyValues.push(orders);
          monetaryValues.push(spent);
        }

        return { ...c, daysSince, orders, spent, lastOrder, firstOrder: firstOrderMap.get(c.id) };
      });

      // Invert recency for scoring (lower days = higher score)
      const invertedRecency = daysSinceValues.map(d => -d);

      // Score all customers
      const scored: CustomerRFM[] = rawData.map(c => {
        const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Onbekend';
        
        if (c.orders === 0) {
          return {
            id: c.id,
            name,
            email: c.email ?? '',
            recency_score: 1,
            frequency_score: 1,
            monetary_score: 1,
            rfm_score: 1,
            segment: 'lost' as RFMSegment,
            days_since_last_order: null,
            total_orders: 0,
            total_spent: 0,
            clv_predicted: 0,
            churn_risk: 'critical' as const,
            email_engagement_score: c.email_engagement_score,
          };
        }

        const r = scoreQuintile(-c.daysSince, invertedRecency);
        const f = scoreQuintile(c.orders, frequencyValues);
        const m = scoreQuintile(c.spent, monetaryValues);
        const segment = classifyRFMSegment(r, f, m);
        
        const daysSinceFirst = c.firstOrder
          ? Math.floor((now - new Date(c.firstOrder).getTime()) / 86400000)
          : Math.floor((now - new Date(c.created_at).getTime()) / 86400000);

        return {
          id: c.id,
          name,
          email: c.email ?? '',
          recency_score: r,
          frequency_score: f,
          monetary_score: m,
          rfm_score: Math.round((r + f + m) / 3 * 100) / 100,
          segment,
          days_since_last_order: c.daysSince === 999 ? null : c.daysSince,
          total_orders: c.orders,
          total_spent: c.spent,
          clv_predicted: predictCLV(c.spent, c.orders, daysSinceFirst),
          churn_risk: assessChurnRisk(c.daysSince === 999 ? null : c.daysSince, c.email_engagement_score),
          email_engagement_score: c.email_engagement_score,
        };
      });

      // Build distribution
      const segmentCounts = new Map<RFMSegment, { count: number; revenue: number }>();
      for (const c of scored) {
        const existing = segmentCounts.get(c.segment) ?? { count: 0, revenue: 0 };
        segmentCounts.set(c.segment, { count: existing.count + 1, revenue: existing.revenue + c.total_spent });
      }

      const distribution: RFMDistribution[] = Object.entries(SEGMENT_META)
        .map(([key, meta]) => {
          const data = segmentCounts.get(key as RFMSegment) ?? { count: 0, revenue: 0 };
          return { segment: key as RFMSegment, ...meta, ...data };
        })
        .filter(d => d.count > 0)
        .sort((a, b) => b.count - a.count);

      const atRiskCount = scored.filter(c => ['at_risk', 'cant_lose', 'critical'].includes(c.churn_risk)).length;
      const totalCLV = scored.reduce((s, c) => s + c.clv_predicted, 0);
      const churnCritical = scored.filter(c => c.churn_risk === 'critical' || c.churn_risk === 'high').length;

      return {
        customers: scored,
        distribution,
        stats: {
          total: scored.length,
          atRisk: atRiskCount,
          avgCLV: scored.length > 0 ? Math.round(totalCLV / scored.length) : 0,
          churnRate: scored.length > 0 ? Math.round((churnCritical / scored.length) * 100) : 0,
        },
      };
    },
    enabled: !!currentTenant?.id,
  });
}
