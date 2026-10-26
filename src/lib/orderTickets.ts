// EVENT-ADMIN-1 — helpers voor het ticketblok in de orderdetail (admin).

export interface OrderTicketRow {
  id: string;
  status: string;
  seq: number | null;
  attendee_name: string | null;
  seat_label: string | null;
  qr_token: string;
  checked_in_at: string | null;
  product_id: string | null;
  products: { name: string } | null;
  event_details: {
    event_date: string | null;
    start_time: string | null;
    product_id: string | null;
    products: { name: string } | null;
  } | null;
}

const KNOWN_STATUSES = ['valid', 'checked_in', 'cancelled', 'refunded', 'transferred'] as const;

/** i18n-sleutel (onder admin.orderTickets) voor een ticketstatus. */
export function ticketStatusKey(status: string): string {
  return (KNOWN_STATUSES as readonly string[]).includes(status) ? `status_${status}` : 'status_unknown';
}

/**
 * De QR-code is het toegangsbewijs: wie hem heeft, komt binnen. In de admin tonen we
 * daarom alleen de laatste 6 tekens (genoeg om een ticket aan de telefoon te herkennen).
 */
export function maskTicketCode(code: string | null | undefined): string {
  const c = (code ?? '').trim();
  if (c.length === 0) return '';
  if (c.length <= 6) return '•'.repeat(c.length);
  return `••••${c.slice(-6).toUpperCase()}`;
}

/** Op eventdatum, dan starttijd, dan volgnummer. */
export function sortOrderTickets<T extends OrderTicketRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const da = `${a.event_details?.event_date ?? ''} ${a.event_details?.start_time ?? ''}`;
    const db = `${b.event_details?.event_date ?? ''} ${b.event_details?.start_time ?? ''}`;
    if (da !== db) return da < db ? -1 : 1;
    return (a.seq ?? 0) - (b.seq ?? 0);
  });
}

// EVENT-409-1 — status van de muntenkaart op de orderdetail. Zelfde labels
// (events.tokens.status_*) en kleuren als Events → Munten → Kaarten.
export const WALLET_STATUSES = ['active', 'refund_requested', 'refunded', 'blocked'] as const;
export type WalletStatus = (typeof WALLET_STATUSES)[number];

export const WALLET_STATUS_VARIANT: Record<WalletStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default', refund_requested: 'outline', refunded: 'secondary', blocked: 'destructive',
};

/** i18n-sleutel (volledig pad) voor een kaartstatus, of null bij een onbekende status. */
export function walletStatusKey(status: string | null | undefined): string | null {
  return (WALLET_STATUSES as readonly string[]).includes(status ?? '') ? `events.tokens.status_${status}` : null;
}
