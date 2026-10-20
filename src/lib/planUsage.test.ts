import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { planLimitMessage, usageLevel } from './planUsage';
import { planLines } from './planLines';
import type { PricingPlan } from '@/types/billing';

describe('LIMITS-1 drempels', () => {
  it('80% = bijna, 100% = vol, geen limiet = ok', () => {
    expect(usageLevel(7, 10)).toBe('ok');
    expect(usageLevel(8, 10)).toBe('near');
    expect(usageLevel(16, 20)).toBe('near');
    expect(usageLevel(20, 20)).toBe('full');
    expect(usageLevel(25, 20)).toBe('full');
    expect(usageLevel(999, null)).toBe('ok');
  });
});

describe('LIMITS-1 foutmelding van de databank', () => {
  const t = (k: string) => k;
  it('herkent product- en gebruikerslimiet', () => {
    expect(planLimitMessage({ message: 'PLAN_LIMIT_PRODUCTS: limiet van 10 bereikt' }, t)).toBe('billing.limit_error.products');
    expect(planLimitMessage(new Error('PLAN_LIMIT_USERS: limiet van 1 bereikt'), t)).toBe('billing.limit_error.users');
  });
  it('laat andere fouten ongemoeid', () => {
    expect(planLimitMessage({ message: 'duplicate key value' }, t)).toBeNull();
    expect(planLimitMessage(null, t)).toBeNull();
  });
});

describe('LIMITS-1 prijzenpagina', () => {
  const t = ((k: string, o?: Record<string, unknown>) => `${k}${o ? JSON.stringify(o) : ''}`) as never;
  const base = { limit_products: 10, limit_users: 1, features: {}, ai_credits_monthly: 0 } as unknown as PricingPlan;
  it('Free toont inbegrepen orders en het percentage daarna', () => {
    const { lines } = planLines({ ...base, limit_orders: 20, overage_fee_percent: 2 } as PricingPlan, t, 'nl');
    expect(lines[1]).toBe('landing.pricing.lim_orders_overage{"n":"20","pct":"2"}');
  });
  it('betaald plan zonder orderlimiet: onbeperkt', () => {
    const { lines } = planLines({ ...base, limit_orders: null, overage_fee_percent: 0 } as PricingPlan, t, 'nl');
    expect(lines[1]).toBe('landing.pricing.lim_orders_unlimited');
  });
  it('MAIL-LIMIT-UI: marketingmails per maand uit de kolom, null = onbeperkt, ontbrekend = geen regel', () => {
    const withMails = planLines({ ...base, limit_orders: null, limit_marketing_emails_monthly: 2500 } as PricingPlan, t, 'nl');
    expect(withMails.lines[3]).toBe('landing.pricing.lim_mails{"n":"2.500"}');
    const unlimited = planLines({ ...base, limit_orders: null, limit_marketing_emails_monthly: null } as PricingPlan, t, 'nl');
    expect(unlimited.lines[3]).toBe('landing.pricing.lim_mails_unlimited');
    const missing = planLines({ ...base, limit_orders: null } as PricingPlan, t, 'nl');
    expect(missing.lines.some((l) => l.includes('lim_mails'))).toBe(false);
  });
});
