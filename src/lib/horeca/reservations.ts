// RESERVATIE-1 — tafelreservaties: een laag boven het zaalplan.
//
// Harde regel (Akke, 29-10): een reservatie raakt nooit een open rekening. Alles hier is weergave:
// welke kleur en welk label een tafel krijgt. Een open rekening wint altijd; niets in deze module
// (of in de database) sluit, verplaatst of wist een rekening. "Aangekomen", "niet gekomen" en
// "geannuleerd" zet altijd een mens.
import { supabase } from '@/integrations/supabase/client';

export type ReservationStatus = 'booked' | 'seated' | 'cancelled' | 'no_show';
export interface Reservation {
  id: string;
  table_id: string | null;
  name: string;
  guests: number;
  phone: string | null;
  note: string | null;
  starts_at: string;
  duration_min: number;
  status: ReservationStatus;
}
export interface ReservationSettings { lead_minutes: number; late_minutes: number }
export const DEFAULT_RESERVATION_SETTINGS: ReservationSettings = { lead_minutes: 60, late_minutes: 15 };

const MIN = 60_000;
const startMs = (r: Pick<Reservation, 'starts_at'>) => new Date(r.starts_at).getTime();

/** Een reservatie die nu op het zaalplan hoort: geboekt, binnen [start − lead, start + duur]. */
export function isActiveOnPlan(r: Reservation, now: number, s: ReservationSettings): boolean {
  if (r.status !== 'booked' || !r.table_id) return false;
  const start = startMs(r);
  return now >= start - s.lead_minutes * MIN && now <= start + r.duration_min * MIN;
}

export function isLate(r: Reservation, now: number, s: ReservationSettings): boolean {
  return r.status === 'booked' && now > startMs(r) + s.late_minutes * MIN;
}

export interface TableReservation { reservation: Reservation; late: boolean }

/**
 * Per tafel de eerstvolgende reservatie die nu op het plan hoort. De kassa beslist zelf of de
 * tafel paars wordt: enkel als er geen open rekening op staat (de rekening wint altijd).
 */
export function reservationsByTable(list: Reservation[], now: number, s: ReservationSettings): Map<string, TableReservation> {
  const m = new Map<string, TableReservation>();
  const sorted = [...list].sort((a, b) => startMs(a) - startMs(b));
  for (const r of sorted) {
    if (!isActiveOnPlan(r, now, s) || m.has(r.table_id!)) continue;
    m.set(r.table_id!, { reservation: r, late: isLate(r, now, s) });
  }
  return m;
}

/** Zelfde kalenderdag in de tijdzone van het toestel. */
export function sameLocalDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
}

/** Lijst voor één dag: geboekt en aangekomen, op uur; geannuleerd en niet gekomen achteraan. */
export function reservationsForDay(list: Reservation[], day: Date): Reservation[] {
  const order = (r: Reservation) => (r.status === 'booked' || r.status === 'seated' ? 0 : 1);
  return list.filter((r) => sameLocalDay(r.starts_at, day)).sort((a, b) => order(a) - order(b) || startMs(a) - startMs(b));
}

/** Standaarduur voor een nieuwe reservatie: het volgende halfuur. */
export function nextHalfHour(now: Date): Date {
  const d = new Date(now);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  d.setMinutes(m < 30 ? 30 : 60);
  return d;
}

/** "HH:MM" in lokale tijd. */
export function timeLabel(iso: string, lng: string): string {
  return new Intl.DateTimeFormat(lng, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

// ── Lezen en schrijven (RLS: zaakvoerder en personeel) ────────────────────────────────────────
const COLS = 'id, table_id, name, guests, phone, note, starts_at, duration_min, status';
const table = () => supabase.from('table_reservations' as never);

export async function fetchReservations(tenantId: string, fromIso: string, toIso: string): Promise<Reservation[]> {
  const { data, error } = await table().select(COLS)
    .eq('tenant_id' as never, tenantId as never).gte('starts_at' as never, fromIso as never).lt('starts_at' as never, toIso as never)
    .order('starts_at' as never, { ascending: true }).limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as Reservation[];
}

export async function fetchReservationSettings(tenantId: string): Promise<ReservationSettings> {
  const { data, error } = await supabase.from('reservation_settings' as never).select('lead_minutes, late_minutes')
    .eq('tenant_id' as never, tenantId as never).maybeSingle();
  if (error) throw error;
  return (data as ReservationSettings | null) ?? DEFAULT_RESERVATION_SETTINGS;
}

export async function saveReservationSettings(tenantId: string, s: ReservationSettings): Promise<void> {
  const { error } = await supabase.from('reservation_settings' as never).upsert({ tenant_id: tenantId, ...s } as never);
  if (error) throw error;
}

export type ReservationInput = Pick<Reservation, 'table_id' | 'name' | 'guests' | 'phone' | 'note' | 'starts_at'> & { duration_min?: number };

export async function createReservation(tenantId: string, r: ReservationInput): Promise<void> {
  const { error } = await table().insert({ tenant_id: tenantId, ...clean(r) } as never);
  if (error) throw error;
}

export async function updateReservation(id: string, patch: Partial<ReservationInput> & { status?: ReservationStatus }): Promise<void> {
  const { error } = await table().update(clean(patch) as never).eq('id' as never, id as never);
  if (error) throw error;
}

function clean<T extends Partial<ReservationInput>>(r: T): T {
  const out = { ...r };
  if (typeof out.name === 'string') out.name = out.name.trim().slice(0, 60);
  if (out.phone !== undefined) out.phone = out.phone?.trim() ? out.phone.trim().slice(0, 30) : null;
  if (out.note !== undefined) out.note = out.note?.trim() ? out.note.trim().slice(0, 200) : null;
  return out;
}
