import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the check-expired-trials edge function logic.
 * Simulates the business logic: find expired trials, downgrade to free, send notifications.
 */

interface TrialRecord {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  trial_end: string;
}

// Simulate check-expired-trials logic
function findExpiredTrials(subscriptions: TrialRecord[], now: Date): TrialRecord[] {
  return subscriptions.filter(
    sub =>
      sub.status === 'trialing' &&
      sub.trial_end !== null &&
      new Date(sub.trial_end) <= now &&
      sub.plan_id !== 'free'
  );
}

function buildDowngradeUpdate(expiredIds: string[]) {
  return {
    table: 'tenant_subscriptions',
    update: {
      plan_id: 'free',
      status: 'active',
      trial_end: null,
    },
    filter: { id_in: expiredIds },
  };
}

function buildNotification(tenantId: string, previousPlanId: string) {
  return {
    tenant_id: tenantId,
    category: 'billing',
    type: 'trial_expired',
    title: 'Je proefperiode is verlopen',
    message: 'Je bent nu op het gratis plan. Al je data is behouden - upgrade om alle features te herstellen.',
    priority: 'high',
    action_url: '/admin/settings/billing',
    data: {
      previous_plan_id: previousPlanId,
      downgraded_at: expect.any(String),
    },
  };
}

describe('check-expired-trials', () => {
  const now = new Date();
  const inPast = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
  const inFuture = (days: number) => new Date(now.getTime() + days * 86400000).toISOString();

  describe('findExpiredTrials', () => {
    it('finds trials with trial_end in the past', () => {
      const subscriptions: TrialRecord[] = [
        { id: 'sub-1', tenant_id: 't-1', plan_id: 'starter', status: 'trialing', trial_end: inPast(1) },
        { id: 'sub-2', tenant_id: 't-2', plan_id: 'pro', status: 'trialing', trial_end: inPast(5) },
      ];

      const expired = findExpiredTrials(subscriptions, now);
      expect(expired).toHaveLength(2);
    });

    it('ignores trials still in the future', () => {
      const subscriptions: TrialRecord[] = [
        { id: 'sub-1', tenant_id: 't-1', plan_id: 'starter', status: 'trialing', trial_end: inFuture(7) },
      ];

      const expired = findExpiredTrials(subscriptions, now);
      expect(expired).toHaveLength(0);
    });

    it('ignores active (non-trialing) subscriptions', () => {
      const subscriptions: TrialRecord[] = [
        { id: 'sub-1', tenant_id: 't-1', plan_id: 'starter', status: 'active', trial_end: inPast(1) },
      ];

      const expired = findExpiredTrials(subscriptions, now);
      expect(expired).toHaveLength(0);
    });

    it('ignores free plan trials (no downgrade needed)', () => {
      const subscriptions: TrialRecord[] = [
        { id: 'sub-1', tenant_id: 't-1', plan_id: 'free', status: 'trialing', trial_end: inPast(1) },
      ];

      const expired = findExpiredTrials(subscriptions, now);
      expect(expired).toHaveLength(0);
    });

    it('returns empty array when no expired trials', () => {
      const expired = findExpiredTrials([], now);
      expect(expired).toHaveLength(0);
    });

    it('handles mixed subscriptions correctly', () => {
      const subscriptions: TrialRecord[] = [
        { id: 'sub-1', tenant_id: 't-1', plan_id: 'starter', status: 'trialing', trial_end: inPast(1) }, // expired
        { id: 'sub-2', tenant_id: 't-2', plan_id: 'pro', status: 'trialing', trial_end: inFuture(7) }, // active trial
        { id: 'sub-3', tenant_id: 't-3', plan_id: 'starter', status: 'active', trial_end: inPast(30) }, // already active
        { id: 'sub-4', tenant_id: 't-4', plan_id: 'free', status: 'trialing', trial_end: inPast(1) }, // free plan
        { id: 'sub-5', tenant_id: 't-5', plan_id: 'enterprise', status: 'trialing', trial_end: inPast(2) }, // expired
      ];

      const expired = findExpiredTrials(subscriptions, now);
      expect(expired).toHaveLength(2);
      expect(expired.map(e => e.id)).toEqual(['sub-1', 'sub-5']);
    });
  });

  describe('buildDowngradeUpdate', () => {
    it('downgrades to free plan with active status', () => {
      const update = buildDowngradeUpdate(['sub-1', 'sub-5']);

      expect(update.update.plan_id).toBe('free');
      expect(update.update.status).toBe('active');
      expect(update.update.trial_end).toBeNull();
    });
  });

  describe('buildNotification', () => {
    it('creates correct notification structure', () => {
      const notif = buildNotification('t-1', 'starter');

      expect(notif.tenant_id).toBe('t-1');
      expect(notif.category).toBe('billing');
      expect(notif.type).toBe('trial_expired');
      expect(notif.priority).toBe('high');
      expect(notif.action_url).toBe('/admin/settings/billing');
      expect(notif.data.previous_plan_id).toBe('starter');
    });

    it('preserves the previous plan ID for context', () => {
      const notifStarter = buildNotification('t-1', 'starter');
      const notifPro = buildNotification('t-2', 'pro');

      expect(notifStarter.data.previous_plan_id).toBe('starter');
      expect(notifPro.data.previous_plan_id).toBe('pro');
    });
  });

  describe('full flow simulation', () => {
    it('processes multiple expired trials correctly', () => {
      const subscriptions: TrialRecord[] = [
        { id: 'sub-1', tenant_id: 't-1', plan_id: 'starter', status: 'trialing', trial_end: inPast(1) },
        { id: 'sub-2', tenant_id: 't-2', plan_id: 'pro', status: 'trialing', trial_end: inPast(3) },
        { id: 'sub-3', tenant_id: 't-3', plan_id: 'starter', status: 'trialing', trial_end: inFuture(5) },
      ];

      // Step 1: Find expired
      const expired = findExpiredTrials(subscriptions, now);
      expect(expired).toHaveLength(2);

      // Step 2: Build update
      const update = buildDowngradeUpdate(expired.map(e => e.id));
      expect(update.filter.id_in).toEqual(['sub-1', 'sub-2']);

      // Step 3: Build notifications
      const notifications = expired.map(e => buildNotification(e.tenant_id, e.plan_id));
      expect(notifications).toHaveLength(2);
      expect(notifications[0].tenant_id).toBe('t-1');
      expect(notifications[1].tenant_id).toBe('t-2');
    });
  });
});
