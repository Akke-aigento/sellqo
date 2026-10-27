import { describe, expect, it } from 'vitest';
import { buildCreditLines, creditTotals, type SourceInvoiceLine } from './creditNoteLines';

const fonske: SourceInvoiceLine[] = [
  { id: 'p', description: 'Pubcrawl ticket', quantity: 1, unit_price: 15.7, vat_rate: 21, vat_amount: 3.3, line_total: 15.7, net_amount: 15.7, gross_amount: 19, line_type: 'product' },
  { id: 'd', description: 'Korting (FONSKE)', quantity: 1, unit_price: -15.7, vat_rate: 21, vat_amount: -3.3, line_total: -15.7, net_amount: -15.7, gross_amount: -19, line_type: 'discount' },
];

const twoTickets: SourceInvoiceLine[] = [
  { id: 'a', description: 'Ticket A', quantity: 1, unit_price: 20.66, vat_rate: 21, vat_amount: 4.34, line_total: 20.66, net_amount: 20.66, gross_amount: 25, line_type: 'product' },
  { id: 'b', description: 'Ticket B', quantity: 1, unit_price: 20.66, vat_rate: 21, vat_amount: 4.34, line_total: 20.66, net_amount: 20.66, gross_amount: 25, line_type: 'product' },
  { id: 'd', description: 'Korting (HALF)', quantity: 1, unit_price: -20.66, vat_rate: 21, vat_amount: -4.34, line_total: -20.66, net_amount: -20.66, gross_amount: -25, line_type: 'discount' },
];

describe('buildCreditLines', () => {
  it('volledige creditnota van een €0-factuur: totaal 0', () => {
    const lines = buildCreditLines(fonske, new Set(), 'full');
    expect(lines).toHaveLength(2);
    expect(creditTotals(lines)).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });

  it('gedeeltelijk: één van twee tickets krijgt de helft van de korting mee', () => {
    const lines = buildCreditLines(twoTickets, new Set(['a']), 'partial');
    expect(lines.map((l) => [l.line_type, l.line_total, l.vat_amount])).toEqual([
      ['product', 20.66, 4.34],
      ['discount', -10.33, -2.17],
    ]);
    expect(creditTotals(lines).total).toBe(12.5);
  });

  it('beide tickets gedeeltelijk = het betaalde bedrag, nooit meer', () => {
    const lines = buildCreditLines(twoTickets, new Set(['a', 'b']), 'partial');
    expect(creditTotals(lines).total).toBe(25);
  });

  it('een kortingsregel zelf kiezen doet niets', () => {
    expect(buildCreditLines(twoTickets, new Set(['d']), 'partial')).toEqual([]);
  });

  it('factuur zonder korting en zonder net_amount (oude orderfactuur): netto = prijs × aantal', () => {
    const old: SourceInvoiceLine[] = [{ id: 'x', description: 'Oud', quantity: 2, unit_price: 10, vat_rate: 21, vat_amount: 4.2, line_total: 20, line_type: 'product' }];
    expect(creditTotals(buildCreditLines(old, new Set(['x']), 'partial'))).toEqual({ subtotal: 20, tax: 4.2, total: 24.2 });
  });

  it('abonnementsfactuur (line_total bruto, net_amount gevuld): netto uit net_amount', () => {
    const sub: SourceInvoiceLine[] = [{ id: 's', description: 'Starter', quantity: 1, unit_price: 29, vat_rate: 21, vat_amount: 6.09, line_total: 35.09, net_amount: 29, gross_amount: 35.09, line_type: 'product' }];
    expect(creditTotals(buildCreditLines(sub, new Set(), 'full'))).toEqual({ subtotal: 29, tax: 6.09, total: 35.09 });
  });
});
