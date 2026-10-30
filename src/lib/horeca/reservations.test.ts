import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { isActiveOnPlan, isLate, nextHalfHour, pendingRequests, reservationsByTable, reservationsForDay, validRange, type Reservation } from './reservations';

const s = { lead_minutes: 60, late_minutes: 15 };
const at = (h: number, m = 0) => new Date(2026, 9, 30, h, m).getTime();
const res = (p: Partial<Reservation> & { id: string }): Reservation => ({
  table_id: 't4', name: 'Jef', guests: 4, phone: null, note: null, starts_at: new Date(at(20)).toISOString(), duration_min: 120, status: 'booked', ...p,
});

describe('RESERVATIE-1 laag boven het zaalplan', () => {
  it('kleurt pas vanaf de ingestelde minuten vooraf en tot het einde van de duur', () => {
    const r = res({ id: 'a' });
    expect(isActiveOnPlan(r, at(18, 59), s)).toBe(false);
    expect(isActiveOnPlan(r, at(19, 0), s)).toBe(true);
    expect(isActiveOnPlan(r, at(22, 0), s)).toBe(true);
    expect(isActiveOnPlan(r, at(22, 1), s)).toBe(false);
    expect(isActiveOnPlan(r, at(19, 30), { ...s, lead_minutes: 15 })).toBe(false);
  });
  it('enkel geboekt en met een tafel; aangekomen, geannuleerd en niet gekomen kleuren niet', () => {
    for (const status of ['seated', 'cancelled', 'no_show'] as const) expect(isActiveOnPlan(res({ id: 'a', status }), at(20), s)).toBe(false);
    expect(isActiveOnPlan(res({ id: 'a', table_id: null }), at(20), s)).toBe(false);
  });
  it('"te laat" na de ingestelde minuten, enkel als weergave', () => {
    expect(isLate(res({ id: 'a' }), at(20, 15), s)).toBe(false);
    expect(isLate(res({ id: 'a' }), at(20, 16), s)).toBe(true);
  });
  it('per tafel de eerstvolgende reservatie', () => {
    const m = reservationsByTable([res({ id: 'later', starts_at: new Date(at(20, 30)).toISOString() }), res({ id: 'eerst' }), res({ id: 'ander', table_id: 't5' })], at(19, 45), s);
    expect(m.get('t4')?.reservation.id).toBe('eerst');
    expect(m.get('t5')?.reservation.id).toBe('ander');
  });
  it('daglijst: geboekt en aangekomen op uur, de rest achteraan; andere dagen niet', () => {
    const list = [
      res({ id: 'x', status: 'cancelled', starts_at: new Date(at(18)).toISOString() }),
      res({ id: 'b', starts_at: new Date(at(21)).toISOString() }),
      res({ id: 'a', status: 'seated', starts_at: new Date(at(19)).toISOString() }),
      res({ id: 'morgen', starts_at: new Date(2026, 9, 31, 12).toISOString() }),
    ];
    expect(reservationsForDay(list, new Date(at(12))).map((r) => r.id)).toEqual(['a', 'b', 'x']);
  });
  it('standaarduur = het volgende halfuur', () => {
    expect(nextHalfHour(new Date(2026, 9, 30, 19, 10)).getMinutes()).toBe(30);
    const d = nextHalfHour(new Date(2026, 9, 30, 19, 40));
    expect([d.getHours(), d.getMinutes()]).toEqual([20, 0]);
  });
});

describe('RESERVATIE-2 online aanvragen', () => {
  it('een aanvraag kleurt geen tafel (pas na bevestigen) en komt eerst in de daglijst', () => {
    const req = res({ id: 'req', status: 'requested' });
    expect(isActiveOnPlan(req, at(20), s)).toBe(false);
    const day = reservationsForDay([res({ id: 'b', starts_at: new Date(at(19)).toISOString() }), req, res({ id: 'x', status: 'declined' })], new Date(at(12)));
    expect(day.map((r) => r.id)).toEqual(['req', 'b', 'x']);
    expect(pendingRequests([req, res({ id: 'b' })]).map((r) => r.id)).toEqual(['req']);
  });
  it('uurbereik: van vóór of gelijk aan tot, formaat HH:MM', () => {
    expect(validRange(['18:00', '21:30'])).toBe(true);
    expect(validRange(['21:00', '18:00'])).toBe(false);
    expect(validRange(['8:00', '9:00'])).toBe(false);
  });
});
