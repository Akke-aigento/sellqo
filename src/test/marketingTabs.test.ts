import { describe, expect, it } from 'vitest';
import {
  MARKETING_TABS, defaultMarketingTab, marketingAutomationsTarget, marketingTabSearch, parseMarketingTab,
} from '@/lib/marketing/marketingTabs';
import { sidebarGroups } from '@/components/admin/sidebar/sidebarConfig';

describe('MAIL-UX-1 marketingTabs', () => {
  it('kent de zes tabbladen en houdt bestaande links werkend', () => {
    expect(MARKETING_TABS).toEqual(['overview', 'campaigns', 'automations', 'templates', 'segments', 'subscribers']);
    expect(parseMarketingTab('subscribers')).toBe('subscribers');
    expect(parseMarketingTab('automations')).toBe('automations');
    expect(parseMarketingTab('email')).toBeNull();
    expect(parseMarketingTab(null)).toBeNull();
  });

  it('kiest Overzicht met campagnes, anders Campagnes', () => {
    expect(defaultMarketingTab(3)).toBe('overview');
    expect(defaultMarketingTab(0)).toBe('campaigns');
  });

  it('bewaart andere parameters en laat ?trigger= enkel bij Automatiseringen', () => {
    const cur = new URLSearchParams('tab=automations&trigger=abandoned_cart&x=1');
    expect(marketingTabSearch(cur, 'campaigns').toString()).toBe('tab=campaigns&x=1');
    expect(marketingTabSearch(cur, 'automations').get('trigger')).toBe('abandoned_cart');
  });

  it('stuurt de oude route door met behoud van de query', () => {
    expect(marketingAutomationsTarget('')).toBe('/admin/marketing?tab=automations');
    expect(marketingAutomationsTarget('?trigger=welcome_series')).toBe('/admin/marketing?trigger=welcome_series&tab=automations');
  });

  it('heeft geen eigen zijbalkitem meer voor automatiseringen', () => {
    const urls = sidebarGroups.flatMap((g) => g.items.flatMap((i) => [i.url, ...(i.children ?? []).map((c) => c.url)]));
    expect(urls).not.toContain('/admin/marketing/automations');
    expect(urls).toContain('/admin/marketing');
  });
});
