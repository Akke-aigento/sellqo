// SUB-UNIFY-2A — unit tests voor de levenscyclus-beslissingen (geen netwerk, geen DB).
// Run: deno test --no-lock supabase/functions/_shared/planLifecycle.test.ts
import {
  addDaysISO,
  decideCancel,
  decidePlanEnding,
  decideResume,
  hasPendingCancellation,
  type SweepRow,
} from './planLifecycle.ts';

function eq(actual: unknown, expected: unknown, msg = '') {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  verwacht: ${e}\n  gekregen: ${a}`);
}

const NOW = new Date('2026-10-16T09:00:00Z');

// ---------------------------------------------------------------- opzeggen

const PAID_RUNNING = {
  currentPlanId: 'pro',
  currentPlanIsPaid: true,
  currentPeriodEnd: '2026-11-05T00:00:00+00:00',
  billingSubscriptionId: 'sub-1',
  billingSubscriptionStatus: 'active',
  nextInvoiceDate: '2026-11-05',
};

Deno.test('addDaysISO telt over maandgrenzen', () => {
  eq(addDaysISO('2026-11-01', -1), '2026-10-31');
  eq(addDaysISO('2026-03-01', -1), '2026-02-28');
  eq(addDaysISO('2026-10-16T10:00:00Z', 1), '2026-10-17');
});

Deno.test('opzeggen met lopende betaalde periode: plan blijft tot het einde', () => {
  eq(decideCancel(PAID_RUNNING, NOW), {
    mode: 'at_period_end',
    accessUntil: '2026-11-05T00:00:00+00:00',
    billingEndDate: '2026-11-04',
  });
});

Deno.test('opzeggen: end_date ligt vóór next_invoice_date, dus de runner maakt geen nieuwe cyclus', () => {
  const d = decideCancel(PAID_RUNNING, NOW);
  if (d.mode !== 'at_period_end') throw new Error('verwacht at_period_end');
  // zelfde vergelijking als generate-subscription-invoices r. ~430
  const skipped = new Date(d.billingEndDate + 'T00:00:00Z') < new Date(PAID_RUNNING.nextInvoiceDate + 'T00:00:00Z');
  eq(skipped, true);
});

Deno.test('opzeggen: volgende cyclus al aangemaakt (next_invoice_date verder) → end_date volgt next_invoice_date', () => {
  const d = decideCancel({ ...PAID_RUNNING, nextInvoiceDate: '2026-12-05' }, NOW);
  eq(d, { mode: 'at_period_end', accessUntil: PAID_RUNNING.currentPeriodEnd, billingEndDate: '2026-12-04' });
});

Deno.test('opzeggen: zonder next_invoice_date valt end_date terug op periode-einde − 1', () => {
  const d = decideCancel({ ...PAID_RUNNING, nextInvoiceDate: null }, NOW);
  eq(d, { mode: 'at_period_end', accessUntil: PAID_RUNNING.currentPeriodEnd, billingEndDate: '2026-11-04' });
});

Deno.test('opzeggen: end_date nooit vóór vandaag', () => {
  const d = decideCancel({ ...PAID_RUNNING, nextInvoiceDate: '2026-10-16' }, NOW);
  eq(d, { mode: 'at_period_end', accessUntil: PAID_RUNNING.currentPeriodEnd, billingEndDate: '2026-10-16' });
});

Deno.test('meteen naar Free: geen betaald plan, geen facturatie-abonnement, gestopt abonnement, of periode voorbij', () => {
  eq(decideCancel({ ...PAID_RUNNING, currentPlanIsPaid: false }, NOW), { mode: 'immediate', reason: 'not_paid_plan' });
  eq(decideCancel({ ...PAID_RUNNING, currentPlanId: null }, NOW), { mode: 'immediate', reason: 'not_paid_plan' });
  eq(decideCancel({ ...PAID_RUNNING, billingSubscriptionId: null }, NOW), { mode: 'immediate', reason: 'no_billing_subscription' });
  eq(decideCancel({ ...PAID_RUNNING, billingSubscriptionStatus: 'cancelled' }, NOW), { mode: 'immediate', reason: 'billing_subscription_inactive' });
  eq(decideCancel({ ...PAID_RUNNING, currentPeriodEnd: '2026-10-01T00:00:00Z' }, NOW), { mode: 'immediate', reason: 'no_running_period' });
  eq(decideCancel({ ...PAID_RUNNING, currentPeriodEnd: null }, NOW), { mode: 'immediate', reason: 'no_running_period' });
});

// ---------------------------------------------------------------- ongedaan maken

const PENDING = { cancel_at_period_end: true, pending_plan_id: 'free', current_period_end: '2026-11-05T00:00:00Z' };

Deno.test('openstaande opzegging herkennen', () => {
  eq(hasPendingCancellation(PENDING), true);
  eq(hasPendingCancellation({ ...PENDING, pending_plan_id: 'starter' }), false, 'gewone downgrade is geen opzegging');
  eq(hasPendingCancellation({ ...PENDING, cancel_at_period_end: false }), false);
  eq(hasPendingCancellation(null), false);
});

Deno.test('ongedaan maken kan alleen zolang abonnement en periode lopen', () => {
  eq(decideResume(PENDING, 'active', NOW), { resume: true });
  eq(decideResume(PENDING, 'cancelled', NOW), { resume: false, reason: 'billing_subscription_inactive' });
  eq(decideResume({ ...PENDING, current_period_end: '2026-10-01T00:00:00Z' }, 'active', NOW), { resume: false, reason: 'period_ended' });
  eq(decideResume({ ...PENDING, pending_plan_id: null }, 'active', NOW), { resume: false, reason: 'nothing_to_resume' });
});

// ---------------------------------------------------------------- sweep

const BASE: SweepRow = {
  tenant_id: 't',
  slug: 'winkel',
  is_demo: false,
  is_internal_tenant: false,
  billing_exempt: false,
  billing_on_hold: false,
  plan_id: 'pro',
  plan_is_paid: true,
  status: 'active',
  current_period_end: '2026-10-10T00:00:00Z',
  trial_end: null,
  cancel_at_period_end: false,
  pending_plan_id: null,
  billing_subscription_id: 'sub-1',
  billing_subscription_status: 'active',
};

Deno.test('sweep: betalende winkel zonder stopsignaal blijft ongemoeid (ook met verstreken periode, zoals Astra)', () => {
  eq(decidePlanEnding(BASE, NOW), { action: 'ignore', reason: 'not_ended' });
});

Deno.test('sweep: free en Events Flex nooit aanraken', () => {
  eq(decidePlanEnding({ ...BASE, plan_id: 'free', cancel_at_period_end: true }, NOW), { action: 'ignore', reason: 'free_or_usage_plan' });
  eq(decidePlanEnding({ ...BASE, plan_id: 'events_flex', plan_is_paid: false, status: 'canceled' }, NOW), { action: 'ignore', reason: 'free_or_usage_plan' });
});

Deno.test('sweep: opgezegd en periode voorbij → naar Free', () => {
  eq(decidePlanEnding({ ...BASE, cancel_at_period_end: true, pending_plan_id: 'free' }, NOW), { action: 'downgrade', triggers: ['cancelled_at_period_end'] });
});

Deno.test('sweep: opgezegd maar periode loopt nog → gepland, niets doen', () => {
  eq(
    decidePlanEnding({ ...BASE, cancel_at_period_end: true, pending_plan_id: 'free', current_period_end: '2026-11-05T00:00:00Z' }, NOW),
    { action: 'scheduled', triggers: ['cancelled_at_period_end'], reason: 'period_running' },
  );
});

Deno.test('sweep: L1 (oude opzegging: status canceled, betaald plan) en L3 (facturatie gestopt, status active)', () => {
  eq(decidePlanEnding({ ...BASE, status: 'canceled', billing_subscription_status: 'cancelled' }, NOW),
    { action: 'downgrade', triggers: ['status_ended', 'billing_subscription_ended'] });
  eq(decidePlanEnding({ ...BASE, billing_subscription_status: 'cancelled' }, NOW),
    { action: 'downgrade', triggers: ['billing_subscription_ended'] });
});

Deno.test('sweep: uitsluitingen in vaste volgorde', () => {
  const ended = { ...BASE, billing_subscription_status: 'cancelled' };
  const reason = (r: SweepRow) => { const d = decidePlanEnding(r, NOW); return d.action + ':' + ('reason' in d ? d.reason : ''); };
  eq(reason({ ...ended, slug: 'sellqo' }), 'excluded:billing_tenant');
  eq(reason({ ...ended, billing_exempt: true }), 'excluded:exempt');
  eq(reason({ ...ended, is_internal_tenant: true }), 'excluded:exempt');
  eq(reason({ ...ended, billing_on_hold: true }), 'excluded:on_hold', 'Sander-winkels');
  eq(reason({ ...ended, is_demo: true }), 'excluded:demo');
  eq(reason({ ...ended, current_period_end: null }), 'excluded:no_period_end');
  eq(reason({ ...ended, trial_end: '2026-10-27T00:00:00Z' }), 'excluded:trial_running');
});

Deno.test('sweep: live-situatie 16-10 — Speeltuin en Sandbox zijn demo, Sander-winkels on hold', () => {
  const speeltuin: SweepRow = { ...BASE, slug: 'sellqo-speeltuin', is_demo: true, plan_id: 'pro', status: 'active', current_period_end: '2026-09-05T00:00:00Z', trial_end: '2026-08-19T00:00:00Z', billing_subscription_status: 'cancelled' };
  eq(decidePlanEnding(speeltuin, NOW), { action: 'excluded', triggers: ['billing_subscription_ended'], reason: 'demo' });
  // Mancini/Zona/Benny: geen facturatie-abonnement, geen opzegging → nooit een stopsignaal, ook niet na 27-10.
  const mancini: SweepRow = { ...BASE, slug: 'mancini-milano', plan_id: 'starter', billing_on_hold: true, current_period_end: '2026-10-27T00:00:00Z', trial_end: '2026-10-27T00:00:00Z', billing_subscription_id: null, billing_subscription_status: null };
  eq(decidePlanEnding(mancini, new Date('2026-11-15T00:00:00Z')), { action: 'ignore', reason: 'not_ended' });
  // ...en mocht er toch een stopsignaal komen: on_hold sluit uit.
  eq(decidePlanEnding({ ...mancini, status: 'canceled' }, new Date('2026-11-15T00:00:00Z')), { action: 'excluded', triggers: ['status_ended'], reason: 'on_hold' });
});

Deno.test('sweep: opgezegd binnen het contract (Events Vast) → wacht tot het contracteinde', () => {
  eq(
    decidePlanEnding({ ...BASE, cancel_at_period_end: true, pending_plan_id: 'free', pending_effective_at: '2027-10-17T00:00:00Z' }, NOW),
    { action: 'scheduled', triggers: ['cancelled_at_period_end'], reason: 'commitment_running' },
  );
  eq(
    decidePlanEnding({ ...BASE, cancel_at_period_end: true, pending_plan_id: 'free', pending_effective_at: '2026-10-01T00:00:00Z' }, NOW),
    { action: 'downgrade', triggers: ['cancelled_at_period_end'] },
  );
});
