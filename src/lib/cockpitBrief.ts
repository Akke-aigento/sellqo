// DASH-2a — de ochtendbrief als lijst i18n-zinnen. Puur: de component vertaalt elke zin
// met t(key, values) en plakt ze achter elkaar. Bedragen, kanaalnamen en leeftijden komen
// als formatters binnen, zodat dit bestand geen i18n, valuta of date-fns-locale kent.
import type { ChannelTotal } from '@/lib/cockpitRevenue';

const K = 'admin.cockpit.brief';

export interface BriefSentence {
  key: string;
  values: Record<string, string | number>;
}

export interface BriefStockProduct {
  id: string;
  name: string;
  stock: number | null;
  low_stock_threshold: number | null;
  track_inventory: boolean | null;
}

export interface BriefInput {
  /** null = geen recht op omzet of nog niet geladen: dan geen zin over gisteren. */
  yesterday: ChannelTotal[] | null;
  /** null = niet van toepassing (geen webshop-spoor) of nog niet geladen. */
  shipping: { openCount: number; oldestAgeMs: number | null } | null;
  /** null = nog niet geladen. */
  products: BriefStockProduct[] | null;
}

export interface BriefFormat {
  money: (amount: number) => string;
  channel: (channel: string) => string;
  /** "2 via bol" — één kanaal met zijn aantal, voor de opsomming. */
  channelCount: (channel: string, count: number) => string;
  age: (ms: number) => string;
  list: (items: string[]) => string;
}

/** Producten met voorraadbeheer die op of onder hun minimum zitten; laagste voorraad eerst. */
export function lowStockProducts(products: BriefStockProduct[]): BriefStockProduct[] {
  return products
    .filter(
      (p) =>
        p.track_inventory === true &&
        p.low_stock_threshold !== null &&
        p.stock !== null &&
        p.stock <= p.low_stock_threshold,
    )
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0) || a.name.localeCompare(b.name));
}

export function buildCockpitBrief(input: BriefInput, fmt: BriefFormat): BriefSentence[] {
  const out: BriefSentence[] = [];

  if (input.yesterday) {
    const rows = input.yesterday.filter((r) => r.count > 0);
    const count = rows.reduce((s, r) => s + r.count, 0);
    const amount = fmt.money(rows.reduce((s, r) => s + r.revenue, 0));
    if (count === 0) {
      out.push({ key: `${K}.yesterday_none`, values: {} });
    } else if (rows.length === 1) {
      out.push({ key: `${K}.yesterday_single`, values: { count, amount, channel: fmt.channel(rows[0].channel) } });
    } else {
      const channels = fmt.list(rows.map((r) => fmt.channelCount(r.channel, r.count)));
      out.push({ key: `${K}.yesterday_channels`, values: { count, amount, channels } });
    }
  }

  if (input.shipping) {
    const { openCount, oldestAgeMs } = input.shipping;
    if (openCount === 0 || oldestAgeMs === null) {
      out.push({ key: `${K}.shipping_none`, values: {} });
    } else {
      out.push({ key: `${K}.shipping_waiting`, values: { count: openCount, age: fmt.age(oldestAgeMs) } });
    }
  }

  if (input.products) {
    const low = lowStockProducts(input.products);
    if (low.length > 0) {
      const first = low[0];
      const stock = first.stock ?? 0;
      out.push(
        stock <= 0
          ? { key: `${K}.stock_out`, values: { name: first.name } }
          : { key: `${K}.stock_low`, values: { name: first.name, count: stock } },
      );
      if (low.length > 1) out.push({ key: `${K}.stock_more`, values: { count: low.length - 1 } });
    }
  }

  return out;
}
