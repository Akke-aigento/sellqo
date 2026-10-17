import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildPriceVars, PRICE_VAR_NAMES } from '@/lib/priceVars';

// PLANS-2 — prijzen in teksten komen uit de database (één bron).
const plans = [
  { id: 'starter', monthly_price: '29.00' },
  { id: 'horeca', monthly_price: '49.00' },
  { id: 'horeca_big', monthly_price: '99.00' },
  { id: 'events_flex', monthly_price: '0', ticket_fee: '0.69' },
  { id: 'events_vast', monthly_price: '49.00', ticket_fee: '0.29', min_term_months: 12 },
];
const addons = [{ id: 'addon_webshop', monthly_price: 19 }, { id: 'addon_horeca', monthly_price: 29 }];

describe('buildPriceVars', () => {
  it('maakt de bedragen uit de rijen, niet uit vaste waarden', () => {
    const v = buildPriceVars(plans, addons, 'nl');
    expect(v.flex_fee).toContain('0,69');
    expect(v.vast_fee).toContain('0,29');
    expect(v.vast_term).toBe('12');
    expect(v.horeca_big_price).toContain('99');
    expect(v.addon_webshop_price).toContain('19');
  });
  it('laat ontbrekende plannen weg in plaats van een verkeerd bedrag te tonen', () => {
    const v = buildPriceVars([], [], 'nl');
    expect(v.flex_fee).toBeUndefined();
  });
});

describe('geen hardcoded prijzen in de marketingteksten', () => {
  it('noemt nergens nog een vast ticket- of planbedrag', () => {
    const dir = path.resolve(__dirname, '../i18n/locales');
    for (const f of fs.readdirSync(dir).filter((x) => x.startsWith('landing.'))) {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      // Ticketfees en de planprijzen horen als {{variabele}} in de tekst te staan.
      expect(raw, f).not.toMatch(/0[.,](49|69|29)\s*(€|per|par|pro|за)/i);
      expect(raw, f).not.toMatch(/€\s?(29|49|79|99|199)\b(?!\d)/);
    }
  });
  it('gebruikt alleen bekende prijsvariabelen', () => {
    const dir = path.resolve(__dirname, '../i18n/locales');
    const known = new Set<string>([...PRICE_VAR_NAMES, 'price', 'fee', 'n', 'count', 'name', 'amount', 'year', 'date', 'days', 'total', 'email', 'shop', 'plan']);
    for (const f of fs.readdirSync(dir).filter((x) => x.startsWith('landing.'))) {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of raw.matchAll(/\{\{\s*(\w+_(?:price|fee|term))\s*\}\}/g)) expect(known.has(m[1]), `${f}: ${m[1]}`).toBe(true);
    }
  });
});
