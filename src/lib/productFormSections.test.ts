import { describe, expect, it } from 'vitest';
import { defaultIsFood, productFormSections } from './productFormSections';

const base = { webshop: false, horeca: false, events: false, productType: 'physical' as const, isFood: false };

describe('productFormSections', () => {
  it('webshop met een t-shirt: geen allergenen, geen horeca, wel verzending en marketplaces', () => {
    const s = productFormSections({ ...base, webshop: true, hasMarketplace: true });
    expect(s.allergens).toBe(false);
    expect(s.horecaCards).toBe(false);
    expect(s.shipping).toBe(true);
    expect(s.marketplacesTab).toBe(true);
    expect(s.foodToggle).toBe(true);
  });

  it('webshop die wijn verkoopt: allergenen ja, horecakaarten nee', () => {
    const s = productFormSections({ ...base, webshop: true, isFood: true });
    expect(s.allergens).toBe(true);
    expect(s.horecaCards).toBe(false);
  });

  it('horeca-gerecht: allergenen en horecakaarten, geen verzending of marketplaces', () => {
    const s = productFormSections({ ...base, horeca: true, isFood: true });
    expect(s.allergens).toBe(true);
    expect(s.horecaCards).toBe(true);
    expect(s.shipping).toBe(false);
    expect(s.marketplacesTab).toBe(false);
    expect(s.adsTab).toBe(false);
  });

  it('horeca, maar niet-voeding (merch): geen allergenen of keuken', () => {
    const s = productFormSections({ ...base, horeca: true, isFood: false });
    expect(s.allergens).toBe(false);
    expect(s.horecaCards).toBe(false);
  });

  it('digitaal product: geen voedingsschakelaar, ook al staat isFood aan', () => {
    const s = productFormSections({ ...base, webshop: true, productType: 'digital', isFood: true });
    expect(s.foodToggle).toBe(false);
    expect(s.allergens).toBe(false);
  });

  it('producttypes per spoor, huidig type blijft altijd zichtbaar', () => {
    expect(productFormSections({ ...base, horeca: true }).productTypes).toEqual(['physical', 'bundle']);
    expect(productFormSections({ ...base, events: true }).productTypes).toEqual(['physical', 'ticket']);
    expect(productFormSections({ ...base, horeca: true, productType: 'digital' }).productTypes).toContain('digital');
    expect(productFormSections({ ...base, webshop: true }).productTypes).not.toContain('ticket');
  });

  it('nieuw product: voeding standaard aan bij horeca', () => {
    expect(defaultIsFood({ horeca: true })).toBe(true);
    expect(defaultIsFood({ horeca: false })).toBe(false);
  });
});

describe('PRODUCT-FORM-2', () => {
  it('dode typen niet kiesbaar, bestaand product houdt zijn type met waarschuwing', () => {
    const shop = productFormSections({ ...base, webshop: true });
    expect(shop.productTypes).toEqual(['physical', 'service', 'bundle']);
    const gift = productFormSections({ ...base, webshop: true, productType: 'gift_card' });
    expect(gift.productTypes).toContain('gift_card');
    expect(gift.undeliveredWarning).toBe(true);
    expect(shop.undeliveredWarning).toBe(false);
  });
  it('marketplaces en advertenties enkel met een koppeling', () => {
    expect(productFormSections({ ...base, webshop: true }).marketplacesTab).toBe(false);
    expect(productFormSections({ ...base, webshop: true, hasMarketplace: true }).marketplacesTab).toBe(true);
    expect(productFormSections({ ...base, webshop: true, hasAds: true }).adsTab).toBe(true);
    expect(productFormSections({ ...base, horeca: true, hasAds: true }).adsTab).toBe(false);
  });
});
