import { describe, expect, it } from 'vitest';
import { resolveCustomerContactEmail } from '../../supabase/functions/_shared/customerContact.ts';

// MAIL-CONTACT-1: support_email is de enige bron; het eigenaar-adres is de
// terugval, info@sellqo.app het laatste redmiddel. notification_email hoort hier
// nooit in — dat is het adres voor de eigen meldingen van de winkel.

describe('resolveCustomerContactEmail', () => {
  it('neemt support_email als die er is', () => {
    expect(resolveCustomerContactEmail({ support_email: 'info@winkel.be', owner_email: 'eigenaar@x.be' })).toBe('info@winkel.be');
  });

  it('valt terug op owner_email bij een lege of ontbrekende support_email', () => {
    expect(resolveCustomerContactEmail({ support_email: null, owner_email: 'eigenaar@x.be' })).toBe('eigenaar@x.be');
    expect(resolveCustomerContactEmail({ support_email: '   ', owner_email: 'eigenaar@x.be' })).toBe('eigenaar@x.be');
    expect(resolveCustomerContactEmail({ owner_email: 'eigenaar@x.be' })).toBe('eigenaar@x.be');
  });

  it('trimt', () => {
    expect(resolveCustomerContactEmail({ support_email: '  info@winkel.be \n' })).toBe('info@winkel.be');
  });

  it('valt terug op info@sellqo.app zonder bruikbaar adres of zonder tenant', () => {
    expect(resolveCustomerContactEmail({ support_email: '', owner_email: '' })).toBe('info@sellqo.app');
    expect(resolveCustomerContactEmail(null)).toBe('info@sellqo.app');
    expect(resolveCustomerContactEmail(undefined)).toBe('info@sellqo.app');
  });

  it('negeert notification_email', () => {
    const tenant = { support_email: null, owner_email: 'eigenaar@x.be', notification_email: 'alerts@x.be' };
    expect(resolveCustomerContactEmail(tenant)).toBe('eigenaar@x.be');
  });
});
