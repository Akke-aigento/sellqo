import { describe, expect, it } from 'vitest';
import { eventReadiness } from './eventReadiness';

const now = new Date('2026-10-14T10:00:00Z');
const ev = { event_date: '2026-10-24', status: 'scheduled', meeting_point: 'Fonske', location_name: null };
const tt = (o: Partial<{ is_active: boolean; sales_start: string | null; sales_end: string | null }> = {}) =>
  ({ is_active: true, sales_start: null, sales_end: null, ...o });

describe('eventReadiness', () => {
  it('is ready with an active ticket type and a meeting point', () => {
    expect(eventReadiness(ev, [tt()], { now }).state).toBe('ready');
  });
  it('blocks without an active ticket type (Fonske 24/10)', () => {
    const r = eventReadiness(ev, [tt({ is_active: false })], { now });
    expect(r.state).toBe('blocked');
    expect(r.blocks).toContain('no_ticket_type');
  });
  it('distinguishes a sales window that has not started from one that ended', () => {
    expect(eventReadiness(ev, [tt({ sales_start: '2026-11-01T00:00:00Z' })], { now }).blocks).toEqual(['sales_not_started']);
    expect(eventReadiness(ev, [tt({ sales_end: '2026-10-01T00:00:00Z' })], { now }).blocks).toEqual(['sales_ended']);
  });
  it('is sellable when one of several ticket types is open', () => {
    expect(eventReadiness(ev, [tt({ sales_end: '2026-10-01T00:00:00Z' }), tt()], { now }).state).toBe('ready');
  });
  it('warns, but does not block, without meeting point or location', () => {
    const r = eventReadiness({ ...ev, meeting_point: ' ' }, [tt()], { now });
    expect(r.state).toBe('warning');
    expect(r.warnings).toEqual(['no_meeting_point']);
  });
  it('flags a past date that is still scheduled, and an inactive product', () => {
    const r = eventReadiness({ ...ev, event_date: '2026-10-01' }, [tt()], { now, productActive: false });
    expect(r.blocks).toEqual(['past_date', 'product_inactive']);
  });
  it('warns when the event is hidden in the shop', () => {
    expect(eventReadiness(ev, [tt()], { now, productHidden: true }).warnings).toEqual(['hidden_in_shop']);
  });
  it('ignores dates that no longer sell', () => {
    expect(eventReadiness({ ...ev, status: 'cancelled' }, [], { now }).state).toBeNull();
  });
});
