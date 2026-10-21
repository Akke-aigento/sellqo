// DASH-2a — omzet per kanaal voor het cockpit-dashboard. Puur (geen supabase), zodat de
// periodes en de kanaalverdeling getest kunnen worden. Kanaal komt UITSLUITEND uit
// resolveOrderChannel (src/lib/salesStats.ts); omzet uitsluitend uit isRevenueOrder.
import { addDays, getDate, getDaysInMonth, startOfDay, startOfMonth, subMonths } from 'date-fns';
import { isCountableOrder, isRevenueOrder, resolveOrderChannel, type ChannelLike, type OrderLike } from '@/lib/salesStats';

/** Kanaalsleutel voor kassaverkopen die niet aan een order hangen. */
export const POS_CHANNEL = 'pos';

export type CockpitOrderRow = OrderLike &
  ChannelLike & { created_at: string | null; total: number | string | null };

export type CockpitPosRow = {
  created_at: string;
  total: number | string | null;
  status: string;
  order_id: string | null;
};

export interface ChannelTotal {
  channel: string;
  revenue: number;
  count: number;
}

export interface CockpitPeriods {
  todayStart: Date;
  yesterdayStart: Date;
  monthStart: Date;
  prevMonthStart: Date;
  /** Einde (exclusief) van de vergelijkbare periode vorige maand. */
  prevCompareEnd: Date;
  now: Date;
}

/**
 * Alle grenzen in LOKALE tijd (date-fns werkt op de lokale klok). Pas bij de query
 * worden ze met toISOString() omgezet; nooit een datum als string afknippen.
 *
 * Vergelijking "dezelfde dagen vorige maand": de 1e tot hetzelfde tijdstip op dezelfde
 * dag vorige maand. Bestaat die dag vorige maand niet (31 maart → februari), dan telt
 * de hele vorige maand.
 */
export function cockpitPeriods(now: Date): CockpitPeriods {
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevCompareEnd =
    getDate(now) > getDaysInMonth(prevMonthStart) ? monthStart : subMonths(now, 1);
  return {
    todayStart,
    yesterdayStart: startOfDay(addDays(todayStart, -1)),
    monthStart,
    prevMonthStart,
    prevCompareEnd,
    now,
  };
}

/** Eén verkoopregel, los van de bron: een omzet-order of een kassaticket zonder order. */
interface Sale {
  at: number;
  channel: string;
  amount: number;
}

const num = (v: number | string | null | undefined) => {
  const n = typeof v === 'string' ? Number(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};

/**
 * Orders (via isRevenueOrder + resolveOrderChannel) plus kassatickets (status completed).
 * Kassatickets met een order_id slaan we over: die omzet zit al in de order.
 */
export function toSales(orders: CockpitOrderRow[], pos: CockpitPosRow[]): Sale[] {
  const out: Sale[] = [];
  for (const o of orders) {
    if (!o.created_at || !isRevenueOrder(o)) continue;
    out.push({ at: new Date(o.created_at).getTime(), channel: resolveOrderChannel(o), amount: num(o.total) });
  }
  for (const p of pos) {
    if (p.status !== 'completed' || p.order_id) continue;
    out.push({ at: new Date(p.created_at).getTime(), channel: POS_CHANNEL, amount: num(p.total) });
  }
  return out;
}

/** Per kanaal binnen [from, to), gesorteerd op omzet (hoogste eerst). */
export function totalsByChannel(sales: Sale[], from: Date, to: Date): ChannelTotal[] {
  const f = from.getTime();
  const t = to.getTime();
  const map = new Map<string, ChannelTotal>();
  for (const s of sales) {
    if (s.at < f || s.at >= t) continue;
    const row = map.get(s.channel) ?? { channel: s.channel, revenue: 0, count: 0 };
    row.revenue += s.amount;
    row.count += 1;
    map.set(s.channel, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue || a.channel.localeCompare(b.channel));
}

export const sumRevenue = (rows: ChannelTotal[]) =>
  Math.round(rows.reduce((s, r) => s + r.revenue, 0) * 100) / 100;

/** Procentuele verandering; null als er vorige periode niets was (geen deling door nul). */
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface CockpitRevenue {
  monthChannels: ChannelTotal[];
  monthTotal: number;
  prevTotal: number;
  changePct: number | null;
  todayRevenue: number;
  /** Bestellingen vandaag (isCountableOrder, alle kanalen) — kassatickets zijn geen bestellingen. */
  todayOrders: number;
  yesterdayChannels: ChannelTotal[];
  periods: CockpitPeriods;
}

export function aggregateCockpitRevenue(
  orders: CockpitOrderRow[],
  pos: CockpitPosRow[],
  now: Date,
): CockpitRevenue {
  const periods = cockpitPeriods(now);
  const sales = toSales(orders, pos);
  // Exclusieve bovengrens net ná "nu", zodat een verkoop van deze milliseconde meetelt.
  const end = new Date(now.getTime() + 1);
  const monthChannels = totalsByChannel(sales, periods.monthStart, end);
  const monthTotal = sumRevenue(monthChannels);
  const prevTotal = sumRevenue(totalsByChannel(sales, periods.prevMonthStart, periods.prevCompareEnd));
  const todayRevenue = sumRevenue(totalsByChannel(sales, periods.todayStart, end));
  const todayStartMs = periods.todayStart.getTime();
  const todayOrders = orders.filter(
    (o) => o.created_at && isCountableOrder(o) && new Date(o.created_at).getTime() >= todayStartMs,
  ).length;
  return {
    monthChannels,
    monthTotal,
    prevTotal,
    changePct: pctChange(monthTotal, prevTotal),
    todayRevenue,
    todayOrders,
    yesterdayChannels: totalsByChannel(sales, periods.yesterdayStart, periods.todayStart),
    periods,
  };
}
