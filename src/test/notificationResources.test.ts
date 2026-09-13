import { describe, expect, it } from 'vitest';
import { NOTIFICATION_CONFIG } from '@/types/notification';
import {
  NOTIFICATION_CATEGORY_RESOURCE,
  canReceiveNotificationCategory,
} from '@/lib/notificationResources';

describe('canReceiveNotificationCategory', () => {
  it('heeft een recht voor elke categorie die het meldingenscherm toont', () => {
    // Een categorie zonder recht wordt in Mijn meldingen stil verborgen. Komt er
    // een categorie bij in NOTIFICATION_CONFIG, dan moet hij hier ook bij.
    for (const { category } of NOTIFICATION_CONFIG) {
      expect(NOTIFICATION_CATEGORY_RESOURCE[category], category).toBeDefined();
    }
  });

  it('geeft warehouse geen facturen, betalingen of marketing', () => {
    expect(canReceiveNotificationCategory(['warehouse'], 'orders')).toBe(true);
    expect(canReceiveNotificationCategory(['warehouse'], 'invoices')).toBe(false);
    expect(canReceiveNotificationCategory(['warehouse'], 'quotes')).toBe(false);
    expect(canReceiveNotificationCategory(['warehouse'], 'payments')).toBe(false);
  });

  it('laat platform_admin alles ontvangen', () => {
    for (const { category } of NOTIFICATION_CONFIG) {
      expect(canReceiveNotificationCategory(['platform_admin'], category)).toBe(true);
    }
  });

  it('geeft zonder rol niets', () => {
    expect(canReceiveNotificationCategory([], 'orders')).toBe(false);
  });
});
