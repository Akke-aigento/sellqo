// GANGEN-1 — gangen: welke gang een lijn krijgt, wat wacht, wat "Versturen" en "Gang vrijgeven" meesturen,
// en dat er geen nieuw fiscaal event bij komt (vrijgeven = fire_course + een gewone ronde).
import { describe, expect, it, vi } from 'vitest';
import { courseFor, firedCourse, goesToBar, isHeld, nextHeldCourse, normalizeCourseSettings, releaseIds, sendableIds } from '../horeca/courses';
import { fireCourse, requestBill, sendRound, type ActionCtx } from '../horeca/actions';
import { applyOptimistic, type Command } from '../horeca/store';
import { isMergeable, planTap } from '../horeca/quickTap';
import type { Check, CheckLine } from '../horeca/types';

let n = 0;
const line = (over: Partial<CheckLine>): CheckLine => ({
  id: `l${++n}`, seq: n, product_id: `p${n}`, variant_id: null, name: 'X', department_id: 'd', department_name: 'D',
  vat_label: 'B', vat_rate: 12, unit_price_cents: 1000, qty: 1, addons: [], note: null, course: null, station_id: null, state: 'draft',
  round_id: null, neg_reason: null, corrects_line_id: null, price_changes: [], void_reason: null, created_by: null, created_at: '', open_qty: 1, ...over,
});
const check = (lines: CheckLine[], over: Partial<Check> = {}): Check => ({
  id: 'chk', table_id: 't1', name: null, status: 'open', guests: 2, opened_at: '', bill_requested_at: null,
  reference: 'chk', version: 1, next_grouping_id: 1, lines, ...over,
});
const ON = normalizeCourseSettings({ courses_enabled: true, course_by_category: { cDessert: 3, cStart: 1, cWine: 0, bad: 7 } });

describe('instellingen en gang per product', () => {
  it('standaard uit; ongeldige waarden vallen weg', () => {
    expect(normalizeCourseSettings(null).enabled).toBe(false);
    expect(ON.byCategory).toEqual({ cDessert: 3, cStart: 1, cWine: 0 });
  });
  it('categorie > gekozen gang > hoofdgerecht; drank/bar en "geen gang" nooit', () => {
    expect(courseFor(ON, { id: 'a', category_id: 'cDessert' }, null, false)).toBe(3);
    expect(courseFor(ON, { id: 'a', category_id: 'cOther' }, null, false)).toBe(2);
    expect(courseFor(ON, { id: 'a', category_id: 'cOther' }, 1, false)).toBe(1);
    expect(courseFor(ON, { id: 'a', category_id: 'cOther' }, 1, true)).toBeNull();
    expect(courseFor(ON, { id: 'a', category_id: 'cWine' }, 3, false)).toBeNull();
    expect(courseFor(normalizeCourseSettings(null), { id: 'a', category_id: 'cDessert' }, 3, false)).toBeNull();
  });
  it('bar volgens product, categorie of standaardpost (zoals de server)', () => {
    const data = { stations: [{ id: 'k', kind: 'kitchen', is_default: true }, { id: 'b', kind: 'bar', is_default: false }],
      routes: [{ station_id: 'b', category_id: 'drank', product_id: null }, { station_id: 'k', category_id: null, product_id: 'irish' }] };
    expect(goesToBar(data, { id: 'cola', category_id: 'drank' })).toBe(true);
    expect(goesToBar(data, { id: 'irish', category_id: 'drank' })).toBe(false);
    expect(goesToBar(data, { id: 'x', category_id: null })).toBe(false);
  });
});

describe('wachten en vrijgeven', () => {
  const lines = () => {
    n = 0;
    return [line({ course: null }), line({ course: 1 }), line({ course: 2 }), line({ course: 3 }), line({ course: 3, state: 'sent' })];
  };
  it('zonder vrijgave = laagste gang; drank en gang 1 gaan mee, 2 en 3 wachten', () => {
    const c = check(lines().slice(0, 4));
    expect(firedCourse(c)).toBe(1);
    expect([...sendableIds(c, true)]).toEqual(['l1', 'l2']);
    expect(nextHeldCourse(c, true)).toBe(2);
    expect(isHeld(c, c.lines[3], false)).toBe(false); // gangen uit: niets wacht
    expect(sendableIds(c, false).size).toBe(4);
  });
  it('vrijgegeven tot 2: gang 3 wacht nog; vrijgeven 3 neemt enkel de ontwerp-lijnen tot en met 3', () => {
    const c = check(lines(), { course_fired: 2 });
    expect(nextHeldCourse(c, true)).toBe(3);
    expect([...releaseIds(c, 3)]).toEqual(['l1', 'l2', 'l3', 'l4']);
  });
  it('enkel hoofdgerechten op de rekening: meteen weg', () => {
    n = 0;
    const c = check([line({ course: 2 }), line({ course: 2 })]);
    expect(sendableIds(c, true).size).toBe(2);
    expect(nextHeldCourse(c, true)).toBeNull();
  });
  it('sneltikken telt niet op over gangen heen', () => {
    n = 0;
    const l = line({ product_id: 'pizza', course: 2 });
    expect(isMergeable(l, 'pizza', [], 3)).toBe(false);
    expect(isMergeable(l, 'pizza', [], 2)).toBe(true);
    expect(isMergeable(l, 'pizza', [])).toBe(true); // gangen uit: zoals vroeger
    expect(planTap(check([l]), 'pizza', [], 3)).toEqual({ kind: 'add' });
  });
  it('optimistisch: fire_course gaat nooit terug, set_note zonder course houdt de gang', () => {
    n = 0;
    const c = check([line({ course: 3 })], { course_fired: 2 });
    const m = new Map([[c.id, c]]);
    applyOptimistic(m, { id: 'x', kind: 'fire_course', check_id: c.id, course: 1 } as Command, new Map());
    expect(m.get(c.id)!.course_fired).toBe(2);
    applyOptimistic(m, { id: 'y', kind: 'fire_course', check_id: c.id, course: 3 } as Command, new Map());
    expect(m.get(c.id)!.course_fired).toBe(3);
    applyOptimistic(m, { id: 'z', kind: 'set_note', check_id: c.id, line_id: 'l1', note: 'zonder ui' } as Command, new Map());
    expect(m.get(c.id)!.lines[0].course).toBe(3);
    applyOptimistic(m, { id: 'w', kind: 'set_note', check_id: c.id, line_id: 'l1', note: 'zonder ui', course: 1 } as Command, new Map());
    expect(m.get(c.id)!.lines[0].course).toBe(1);
  });
});

describe('versturen en vrijgeven: gewone rondes, geen nieuw fiscaal event', () => {
  const mk = (c: Check, coursesEnabled: boolean) => {
    const sent: Command[] = [];
    const store = {
      tenantId: 't', deviceId: 'd', pendingCount: 0, flush: async () => {}, check: () => c,
      applyNow: vi.fn(async (cmd: Command) => {
        sent.push(cmd);
        if (cmd.kind === 'fire_course') c.course_fired = Math.max(c.course_fired ?? 0, Number(cmd.course));
        return { id: cmd.id, ok: true };
      }),
    };
    const ctx = { store, runtime: { isFiscal: false }, staffId: 's1', staffName: 'S', employeeId: null, tableLabel: () => 'B1', coursesEnabled } as unknown as ActionCtx;
    return { ctx, sent };
  };
  it('Versturen met gangen aan: enkel wat niet wacht', async () => {
    n = 0;
    const c = check([line({ course: null }), line({ course: 1 }), line({ course: 3 })]);
    const { ctx, sent } = mk(c, true);
    expect((await sendRound(ctx, c.id)).ok).toBe(true);
    expect(sent.map((x) => x.kind)).toEqual(['send_round']);
    expect(sent[0].line_ids).toEqual(['l1', 'l2']);
  });
  it('gangen uit: alles, zoals vroeger', async () => {
    n = 0;
    const c = check([line({ course: null }), line({ course: 1 }), line({ course: 3 })]);
    const { ctx, sent } = mk(c, false);
    await sendRound(ctx, c.id);
    expect(sent[0].line_ids).toEqual(['l1', 'l2', 'l3']);
  });
  it('Gang vrijgeven = fire_course (niet fiscaal) + send_round van die gang', async () => {
    n = 0;
    const c = check([line({ course: 1, state: 'sent' }), line({ course: 3 })], { course_fired: 1 });
    const { ctx, sent } = mk(c, true);
    expect((await fireCourse(ctx, c.id, 3)).ok).toBe(true);
    expect(sent.map((x) => x.kind)).toEqual(['fire_course', 'send_round']);
    expect(sent[1].line_ids).toEqual(['l2']);
    expect(sent[1].fiscal_event_id).toBeNull();
  });
  it('voorrekening: wat nog wachtte gaat eerst mee', async () => {
    n = 0;
    const c = check([line({ course: 1, state: 'sent' }), line({ course: 3 })], { course_fired: 1 });
    const { ctx, sent } = mk(c, true);
    await requestBill(ctx, c.id);
    expect(sent[0].kind).toBe('send_round');
    expect(sent[0].line_ids).toEqual(['l2']);
  });
});
