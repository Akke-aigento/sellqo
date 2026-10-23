// TAFEL-1 — vorm van een rekening zoals public.horeca_check_json ze teruggeeft.
export type LineState = 'draft' | 'sent' | 'void';
export type NegReason = 'CORRECTION' | 'PRICE_CHANGE' | 'COST_CENTER_CHANGE' | 'REFUND' | 'PRODUCT_SUBSTITUTION' | 'OTHER';

export interface LineAddon { option_id: string; name: string; price_cents: number }
export interface LinePriceChange { grouping_id: number; id: string; name: string; scope: 'LINE' | 'EVENT'; type: 'PUBLIC' | 'INTERNAL'; amount_cents: number }

export interface CheckLine {
  id: string;
  seq: number;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  department_id: string;
  department_name: string;
  vat_label: 'A' | 'B' | 'C' | 'D' | 'X';
  vat_rate: number;
  unit_price_cents: number;
  qty: number;
  addons: LineAddon[];
  note: string | null;
  course: number | null;
  station_id: string | null;
  state: LineState;
  round_id: string | null;
  neg_reason: NegReason | null;
  corrects_line_id: string | null;
  price_changes: LinePriceChange[];
  void_reason: string | null;
  created_by: string | null;
  created_at: string;
  /** Wat er van deze lijn nog open staat (0 bij negatieve en geschrapte lijnen). */
  open_qty: number;
  /** Enkel lokaal: nog niet door de server bevestigd. */
  pending?: boolean;
}

export interface Check {
  id: string;
  table_id: string | null;
  name: string | null;
  status: 'open' | 'closed' | 'void';
  guests: number | null;
  opened_at: string;
  bill_requested_at: string | null;
  reference: string;
  version: number;
  next_grouping_id: number;
  lines: CheckLine[];
}

export interface Snapshot { version: number; checks: Check[] }

/** Bedrag van een lijn in centen: product + supplementen + prijswijzigingen. */
export function lineTotalCents(l: Pick<CheckLine, 'qty' | 'unit_price_cents' | 'addons' | 'price_changes'>): number {
  const addons = l.addons.reduce((s, a) => s + a.price_cents, 0);
  return l.qty * (l.unit_price_cents + addons) + l.price_changes.reduce((s, p) => s + p.amount_cents, 0);
}

/** Totaal van een rekening: alle niet-geschrapte lijnen (ontwerp inbegrepen). */
export function checkTotalCents(c: Pick<Check, 'lines'>): number {
  return c.lines.filter((l) => l.state !== 'void').reduce((s, l) => s + lineTotalCents(l), 0);
}
