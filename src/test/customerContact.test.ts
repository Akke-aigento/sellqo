import { describe, expect, it } from 'vitest';
import {
  resolveCustomerContactEmail,
  resolveTenantMailPrefix,
  tenantMailAddress,
} from '../../supabase/functions/_shared/customerContact.ts';

// MAIL-SENDER-1: support_email wint; zonder eigen adres is het antwoordadres de
// SellQo-inbox van de winkel. owner_email en notification_email horen er niet in;
// info@sellqo.app is alleen de noodval zonder geldige prefix.

describe('resolveCustomerContactEmail', () => {
  it('neemt support_email als die er is', () => {
    expect(resolveCustomerContactEmail({ support_email: ' info@winkel.be ', inbound_email_prefix: 'winkel' })).toBe('info@winkel.be');
  });

  it('valt terug op <prefix>@mail.sellqo.app bij een lege support_email', () => {
    expect(resolveCustomerContactEmail({ support_email: null, inbound_email_prefix: 'vanxcel' })).toBe('vanxcel@mail.sellqo.app');
    expect(resolveCustomerContactEmail({ support_email: '  ', inbound_email_prefix: 'vanxcel' })).toBe('vanxcel@mail.sellqo.app');
  });

  it('gebruikt de slug als inbound_email_prefix ontbreekt', () => {
    expect(resolveCustomerContactEmail({ slug: 'loveke' })).toBe('loveke@mail.sellqo.app');
  });

  it('negeert owner_email en notification_email', () => {
    const tenant = { inbound_email_prefix: 'loveke', owner_email: 'eigenaar@x.be', notification_email: 'alerts@x.be' };
    expect(resolveCustomerContactEmail(tenant)).toBe('loveke@mail.sellqo.app');
  });

  it('valt alleen zonder geldige prefix terug op info@sellqo.app', () => {
    expect(resolveCustomerContactEmail({ inbound_email_prefix: 'Met Spatie', slug: '' })).toBe('info@sellqo.app');
    expect(resolveCustomerContactEmail(null)).toBe('info@sellqo.app');
  });
});

describe('resolveTenantMailPrefix / tenantMailAddress', () => {
  it('normaliseert en valideert', () => {
    expect(resolveTenantMailPrefix({ inbound_email_prefix: ' VanXcel ' })).toBe('vanxcel');
    expect(resolveTenantMailPrefix({ inbound_email_prefix: 'bad.prefix', slug: 'goed' })).toBe('goed');
    expect(tenantMailAddress({ slug: '-fout' })).toBeNull();
  });
});
