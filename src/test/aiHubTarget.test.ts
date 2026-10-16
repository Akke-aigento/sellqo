// MARKETING-2/3 — oude links naar de AI Content Hub landen op de juiste nieuwe plek, met parameters.
import { describe, expect, it } from 'vitest';
import { aiHubTarget } from '@/lib/marketing/aiHubTarget';

describe('aiHubTarget', () => {
  it('stuurt de checkout-terugkeer met alle parameters naar Social', () => {
    expect(aiHubTarget('?purchase=success&credits=100&session_id=cs_1')).toBe(
      '/admin/marketing/social?purchase=success&credits=100&session_id=cs_1',
    );
    expect(aiHubTarget('?purchase=cancelled')).toBe('/admin/marketing/social?purchase=cancelled');
  });
  it('kent elke oude tab een plek toe', () => {
    expect(aiHubTarget('')).toBe('/admin/marketing/social');
    expect(aiHubTarget('?tab=social&product=p1')).toBe('/admin/marketing/social?product=p1&ai=post');
    expect(aiHubTarget('?tab=create')).toBe('/admin/marketing/social?ai=post');
    expect(aiHubTarget('?tab=email')).toBe('/admin/marketing?ai=email');
    expect(aiHubTarget('?tab=assets')).toBe('/admin/marketing/media');
    expect(aiHubTarget('?tab=library')).toBe('/admin/marketing/social');
    expect(aiHubTarget('?tab=menu')).toBe('/admin/marketing/social');
  });
});
