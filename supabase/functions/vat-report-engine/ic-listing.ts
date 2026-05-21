// Builds the IC-listing (intra-community supplies per VAT-number).
// Filters out invoices without a VIES snapshot and emits warnings via the
// returned excludedInvoiceNumbers (caller wires those into the report).

import type { DbInvoice, IcListingEntry } from './types.ts';

const IC_REGIMES = new Set([
  'ic_supply_goods',
  'ic_supply_services',
  'ic_supply_triangulation',
  'ic_triangulation',
]);

function typeCode(regime: string): 'L' | 'T' | 'S' {
  if (regime === 'ic_supply_services') return 'S';
  if (regime === 'ic_supply_triangulation' || regime === 'ic_triangulation') return 'T';
  return 'L';
}

export interface IcListingResult {
  entries: IcListingEntry[];
  excludedInvoiceNumbers: string[]; // missing VIES snapshot
}

export function buildIcListing(invoices: DbInvoice[]): IcListingResult {
  const groups = new Map<string, IcListingEntry>();
  const excluded: string[] = [];

  for (const inv of invoices) {
    if (!inv.vat_regime || !IC_REGIMES.has(inv.vat_regime)) continue;
    const cust = inv.customers;
    const vatNr = (inv.vat_number_validated_value || cust?.vat_number || '').trim().toUpperCase();
    if (!inv.vat_number_validated_at || !vatNr) {
      excluded.push(inv.invoice_number);
      continue;
    }
    const country = vatNr.slice(0, 2) || (cust?.billing_country || '').toUpperCase();
    const key = `${vatNr}::${typeCode(inv.vat_regime)}`;
    const base = Number(inv.subtotal || 0);
    const existing = groups.get(key);
    if (existing) {
      existing.amount += base;
      existing.invoice_ids.push(inv.id);
    } else {
      groups.set(key, {
        vat_number: vatNr,
        country_code: country,
        company_name: cust?.company_name || customerDisplayName(cust),
        amount: base,
        type_code: typeCode(inv.vat_regime),
        invoice_ids: [inv.id],
      });
    }
  }

  for (const entry of groups.values()) {
    entry.amount = Math.round(entry.amount * 100) / 100;
  }

  const entries = Array.from(groups.values())
    .sort((a, b) => a.vat_number.localeCompare(b.vat_number));

  return { entries, excludedInvoiceNumbers: excluded };
}

function customerDisplayName(c: DbInvoice['customers'] | undefined | null): string {
  if (!c) return '';
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  return name || c.email || '';
}