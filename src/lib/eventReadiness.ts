// EVENT-FLOW-2 — is een eventdatum verkoopbaar? Volgt exact de poorten van storefront-api
// cart_add_item: status scheduled/confirmed, een actief tickettype, en een verkoopvenster
// dat nu open is. "Geen verzamelpunt" blokkeert de verkoop niet, maar de klant krijgt dan
// geen plaats in zijn ticketmail; dat is een waarschuwing.

export type ReadinessBlock = 'no_ticket_type' | 'sales_not_started' | 'sales_ended' | 'past_date' | 'product_inactive';
export type ReadinessWarning = 'no_meeting_point';

export interface ReadinessEvent {
  event_date: string;
  status: string;
  meeting_point: string | null;
  location_name: string | null;
}

export interface ReadinessTicketType {
  is_active: boolean;
  sales_start: string | null;
  sales_end: string | null;
}

export interface Readiness {
  /** null = datum doet niet meer mee (geannuleerd, overgeslagen, samengevoegd, afgerond). */
  state: 'ready' | 'warning' | 'blocked' | null;
  blocks: ReadinessBlock[];
  warnings: ReadinessWarning[];
}

const SELLING_STATUSES = ['scheduled', 'confirmed'];

const todayIso = (now: Date) => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export function eventReadiness(
  event: ReadinessEvent,
  ticketTypes: ReadinessTicketType[],
  opts: { now?: Date; productActive?: boolean } = {},
): Readiness {
  if (!SELLING_STATUSES.includes(event.status)) return { state: null, blocks: [], warnings: [] };
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();
  const blocks: ReadinessBlock[] = [];
  const warnings: ReadinessWarning[] = [];

  if (event.event_date < todayIso(now)) blocks.push('past_date');
  if (opts.productActive === false) blocks.push('product_inactive');

  const active = ticketTypes.filter((tt) => tt.is_active);
  if (active.length === 0) {
    blocks.push('no_ticket_type');
  } else {
    const open = active.some((tt) => {
      const start = tt.sales_start ? new Date(tt.sales_start).getTime() : null;
      const end = tt.sales_end ? new Date(tt.sales_end).getTime() : null;
      return (start === null || nowMs >= start) && (end === null || nowMs <= end);
    });
    if (!open) {
      const notStarted = active.some((tt) => tt.sales_start && new Date(tt.sales_start).getTime() > nowMs);
      blocks.push(notStarted ? 'sales_not_started' : 'sales_ended');
    }
  }

  if (!event.meeting_point?.trim() && !event.location_name?.trim()) warnings.push('no_meeting_point');

  return { state: blocks.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'ready', blocks, warnings };
}
