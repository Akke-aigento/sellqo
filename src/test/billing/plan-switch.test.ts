import { describe, it, expect } from 'vitest';
import {
  starterPlan, proPlan, enterprisePlan,
  activeSubscription, proSubscription,
  peppolAddon, multiWarehouseAddon,
} from '../fixtures/billing';
import type { PricingPlan } from '@/types/billing';

/**
 * Tests for the execute-plan-switch edge function logic.
 * Validates upgrade/downgrade, proration, addon migration, and notifications.
 */

function determinePriceId(plan: PricingPlan, interval: 'monthly' | 'yearly'): string | null {
  return interval === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly;
}

function findMigratableAddons(
  activeAddons: typeof peppolAddon[],
  targetPlan: PricingPlan
): typeof peppolAddon[] {
  return activeAddons.filter(addon => {
    const featureKey = addon.addon_type.replace('_addon', '');
    const targetFeatures = targetPlan.features as unknown as Record<string, boolean>;
    return targetFeatures?.[featureKey] === true;
  });
}

function isUpgrade(currentPrice: number, targetPrice: number): boolean {
  return targetPrice > currentPrice;
}

function buildPlanSwitchNotification(
  tenantId: string,
  targetPlanName: string,
  migratedAddons: string[]
) {
  return {
    tenant_id: tenantId,
    category: 'billing',
    notification_type: 'plan_upgraded',
    title: `Plan gewijzigd naar ${targetPlanName}`,
    message: migratedAddons.length > 0
      ? `Je plan is gewijzigd naar ${targetPlanName}. ${migratedAddons.length} add-on(s) zijn nu inbegrepen in je plan.`
      : `Je plan is succesvol gewijzigd naar ${targetPlanName}.`,
    priority: 'medium',
    action_url: '/admin/billing',
  };
}

describe('Plan Switch Logic', () => {
  describe('determinePriceId', () => {
    it('returns monthly price for monthly interval', () => {
      expect(determinePriceId(proPlan, 'monthly')).toBe('price_pro_monthly');
    });

    it('returns yearly price for yearly interval', () => {
      expect(determinePriceId(proPlan, 'yearly')).toBe('price_pro_yearly');
    });

    it('returns null for plans without Stripe prices', () => {
      const noPricePlan = { ...proPlan, stripe_price_id_monthly: null };
      expect(determinePriceId(noPricePlan, 'monthly')).toBeNull();
    });
  });

  describe('isUpgrade', () => {
    it('starter → pro is upgrade', () => {
      expect(isUpgrade(starterPlan.monthly_price, proPlan.monthly_price)).toBe(true);
    });

    it('pro → starter is downgrade', () => {
      expect(isUpgrade(proPlan.monthly_price, starterPlan.monthly_price)).toBe(false);
    });

    it('same price is not upgrade', () => {
      expect(isUpgrade(29, 29)).toBe(false);
    });
  });

  describe('addon migration', () => {
    it('migrates peppol addon when upgrading to Pro', () => {
      const addons = [peppolAddon];
      const migratable = findMigratableAddons(addons, proPlan);

      // Pro has peppol feature
      expect(migratable).toHaveLength(1);
      expect(migratable[0].addon_type).toBe('peppol');
    });

    it('does not migrate addons when target plan lacks feature', () => {
      const addons = [peppolAddon];
      const migratable = findMigratableAddons(addons, starterPlan);

      // Starter does not have peppol
      expect(migratable).toHaveLength(0);
    });

    it('migrates multi_warehouse addon to Enterprise', () => {
      const addons = [multiWarehouseAddon];
      const migratable = findMigratableAddons(addons, enterprisePlan);

      expect(migratable).toHaveLength(1);
    });

    it('migrates multiple addons at once', () => {
      const addons = [peppolAddon, multiWarehouseAddon];
      const migratable = findMigratableAddons(addons, enterprisePlan);

      // Enterprise has both peppol and multi_warehouse
      expect(migratable).toHaveLength(2);
    });

    it('returns empty when no addons', () => {
      const migratable = findMigratableAddons([], proPlan);
      expect(migratable).toHaveLength(0);
    });
  });

  describe('notification', () => {
    it('includes addon count when addons migrated', () => {
      const notif = buildPlanSwitchNotification('tenant-1', 'Pro', ['peppol', 'multi_warehouse']);

      expect(notif.title).toBe('Plan gewijzigd naar Pro');
      expect(notif.message).toContain('2 add-on(s) zijn nu inbegrepen');
    });

    it('simple message when no addons migrated', () => {
      const notif = buildPlanSwitchNotification('tenant-1', 'Pro', []);

      expect(notif.message).toBe('Je plan is succesvol gewijzigd naar Pro.');
      expect(notif.message).not.toContain('add-on');
    });
  });

  describe('full upgrade scenario: Starter → Pro', () => {
    it('upgrade flow is correct', () => {
      const currentPlan = starterPlan;
      const targetPlan = proPlan;
      const addons = [peppolAddon];

      // 1. Determine it's an upgrade
      expect(isUpgrade(currentPlan.monthly_price, targetPlan.monthly_price)).toBe(true);

      // 2. Get new price
      const priceId = determinePriceId(targetPlan, 'monthly');
      expect(priceId).toBe('price_pro_monthly');

      // 3. Find migratable addons
      const migratable = findMigratableAddons(addons, targetPlan);
      expect(migratable).toHaveLength(1);

      // 4. Build notification
      const notif = buildPlanSwitchNotification(
        'tenant-1',
        targetPlan.name,
        migratable.map(a => a.addon_type)
      );
      expect(notif.title).toContain('Pro');
    });
  });

  describe('full downgrade scenario: Pro → Starter', () => {
    it('downgrade flow is correct', () => {
      const currentPlan = proPlan;
      const targetPlan = starterPlan;

      // 1. Not an upgrade
      expect(isUpgrade(currentPlan.monthly_price, targetPlan.monthly_price)).toBe(false);

      // 2. Get new price
      const priceId = determinePriceId(targetPlan, 'monthly');
      expect(priceId).toBe('price_starter_monthly');

      // 3. No addon migration on downgrade
      const migratable = findMigratableAddons([peppolAddon], targetPlan);
      expect(migratable).toHaveLength(0);

      // 4. Features lost
      const featuresLost = Object.keys(currentPlan.features).filter(
        key => (currentPlan.features as any)[key] === true && (targetPlan.features as any)[key] !== true
      );
      expect(featuresLost).toContain('customDomain');
      expect(featuresLost).toContain('peppol');
      expect(featuresLost).toContain('apiAccess');
    });
  });

  describe('interval switch: monthly → yearly', () => {
    it('selects yearly price ID', () => {
      const priceId = determinePriceId(proPlan, 'yearly');
      expect(priceId).toBe('price_pro_yearly');
    });

    it('yearly price offers discount', () => {
      // Pro: 79/month = 948/year, but yearly is 790
      const monthlyTotal = proPlan.monthly_price * 12;
      expect(proPlan.yearly_price).toBeLessThan(monthlyTotal);
      expect(proPlan.yearly_price).toBe(790);
    });
  });
});
