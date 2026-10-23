// TAFEL-1 — van rekeninglijnen naar fiscale lijnen (LineSpec) voor de FDM-berichten.
//
// - Een supplement met een prijs (mayonaise € 2,50) is een eigen productlijn (UC4120bis);
//   zonder prijs gaat het enkel naar de keuken (TX-09).
// - Een korting is een priceChange LINE/PUBLIC op de productprijs (TX-11), met de
//   groupingId van de rekening (TX-12).
// - Negatieve lijnen dragen hun reden (TX-07): CORRECTION bij annuleren, PRICE_CHANGE bij een
//   korting op een al bestelde lijn, COST_CENTER_CHANGE bij verplaatsen.
// - Ronde = enkel de nieuwe lijnen (EVT-06). Voorrekening en afrekenen = geconsolideerde
//   stand (EVT-07, PRT-07).
import { divRoundHalfUp, milli4 } from '../../fiscal/money';
import { costCenter, mirrorForTransfer, type LineSpec, type ProductSpec } from '../../fiscal/builders';
import type { CostCenterInput, NegQuantityReason } from '../../fiscal/types';
import type { Check, CheckLine } from './types';

export const SUPPLEMENT_DEPARTMENT = { id: 'SUPP', name: 'Supplementen' } as const;

function product(l: CheckLine): ProductSpec['product'] {
  return { productId: l.product_id ?? l.id, productName: l.name, departmentId: l.department_id, departmentName: l.department_name };
}

const reasonOf = (l: CheckLine): NegQuantityReason | null => (l.qty < 0 ? (l.neg_reason as NegQuantityReason) : null);

/** Eén rekeninglijn → één of meer fiscale lijnen (hoofdproduct + betaalde supplementen). */
export function lineSpecsOf(l: CheckLine): LineSpec[] {
  const out: LineSpec[] = [{
    kind: 'single',
    main: {
      product: product(l),
      quantity: milli4(l.qty),
      unitPrice: milli4(l.unit_price_cents / 100),
      negQuantityReason: reasonOf(l),
      vats: [{
        label: l.vat_label,
        priceChanges: l.price_changes.length
          ? l.price_changes.map((p) => ({ groupingId: p.grouping_id, id: p.id, name: p.name, scope: p.scope, type: p.type, amount: p.amount_cents }))
          : undefined,
      }],
    },
  }];
  for (const a of l.addons) {
    if (a.price_cents <= 0) continue;
    out.push({
      kind: 'single',
      main: {
        product: { productId: a.option_id, productName: a.name, departmentId: SUPPLEMENT_DEPARTMENT.id, departmentName: SUPPLEMENT_DEPARTMENT.name },
        quantity: milli4(l.qty),
        unitPrice: milli4(a.price_cents / 100),
        negQuantityReason: reasonOf(l),
        vats: [{ label: l.vat_label }],
      },
    });
  }
  return out;
}

/** De lijnen van de volgende ronde: alle ontwerp-lijnen, in volgorde (EVT-04). */
export function roundLines(c: Check): CheckLine[] {
  return c.lines.filter((l) => l.state === 'draft' && !l.pending).sort((a, b) => a.seq - b.seq);
}

export function roundSpecs(c: Check): LineSpec[] {
  return roundLines(c).flatMap(lineSpecsOf);
}

/**
 * Geconsolideerde stand van een rekening (voorrekening, afrekenen): per product, prijs,
 * supplementen en korting het netto aantal; enkel wat er netto open staat.
 * Lijnen met dezelfde korting tellen samen; elke korting houdt haar groupingId.
 */
export function consolidatedLines(c: Check): CheckLine[] {
  const live = c.lines.filter((l) => l.state === 'sent');
  const groups = new Map<string, CheckLine>();
  for (const l of [...live].sort((a, b) => a.seq - b.seq)) {
    // Negatieve lijnen kortingen we naar hun "doellijn": zelfde product/prijs/supplementen.
    const pcKey = (x: CheckLine) => x.price_changes.map((p) => `${p.grouping_id}:${p.id}:${p.name}`).join('|');
    const key = [l.product_id ?? l.name, l.variant_id ?? '', l.unit_price_cents, l.vat_label, l.addons.map((a) => `${a.option_id}:${a.price_cents}`).join(','), pcKey(l)].join('#');
    const cur = groups.get(key);
    if (!cur) {
      groups.set(key, { ...l, qty: l.qty, price_changes: l.price_changes.map((p) => ({ ...p })), neg_reason: null, corrects_line_id: null });
    } else {
      cur.qty += l.qty;
      cur.price_changes = cur.price_changes.map((p, i) => ({ ...p, amount_cents: p.amount_cents + (l.price_changes[i]?.amount_cents ?? 0) }));
    }
  }
  return [...groups.values()].filter((l) => l.qty > 0);
}

export function consolidatedSpecs(c: Check): LineSpec[] {
  return consolidatedLines(c).flatMap(lineSpecsOf);
}

/** costCenter van een rekening (TBL-01/02): tafel = TABLE, op naam = CUSTOMER; reference = sessie. */
export function costCenterOf(c: Pick<Check, 'id' | 'table_id' | 'name' | 'reference' | 'split_of' | 'parent_reference'>, tableLabel: string | null): CostCenterInput {
  // TAFEL-2: deelrekening van een tafel = TABLE (reference van de hoofdrekening) › CHAIR
  // (eigen reference), zoals UC4119bis. Max. 2 niveaus (TBL-01).
  // Het CHAIR-id is de eigen reference (uniek, ligt vast vóór de server het deel aanmaakt);
  // het volgnummer "deel 2" is enkel weergave.
  if (c.table_id && c.split_of && c.parent_reference) {
    return costCenter('TABLE', tableLabel || c.table_id, c.parent_reference, { id: c.reference, type: 'CHAIR', reference: c.reference });
  }
  if (c.table_id) return costCenter('TABLE', tableLabel || c.table_id, c.reference);
  return costCenter('CUSTOMER', (c.name || c.id).slice(0, 40), c.reference);
}

/** Transfer-zijden voor een verplaatsing van verstuurde lijnen (TBL-04/05). */
export function transferSpecs(moved: { line: CheckLine; qty: number }[]): { from: LineSpec[]; to: LineSpec[] } {
  const to: LineSpec[] = [];
  const from: LineSpec[] = [];
  for (const { line, qty } of moved) {
    const scaled: CheckLine = {
      ...line,
      qty,
      neg_reason: null,
      // Zelfde afronding als de server (round() in Postgres: half weg van nul).
      price_changes: line.price_changes.map((p) => ({ ...p, amount_cents: divRoundHalfUp(p.amount_cents * qty, line.qty) })),
    };
    for (const s of lineSpecsOf(scaled)) {
      to.push(s);
      from.push(mirrorForTransfer(s));
    }
  }
  return { from, to };
}

/**
 * Reference waaraan een ondertekend event hangt (fiscal_events.cost_center_reference): het
 * onderste niveau van de costCenter. Bij een deelrekening (TABLE › CHAIR) is dat het deel,
 * niet de hoofdrekening; zo controleert horeca_pay het ook.
 */
export function eventCostCenterReference(cc: CostCenterInput | null | undefined): string | null {
  if (!cc) return null;
  return cc.costCenter?.reference ?? cc.reference;
}
