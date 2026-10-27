// INVOICE-INTEGRITY-1 — de factuurregels van een order, op de cent, met de korting als regel.
//
// Aanleiding (27-10-2026): generate-invoice zette een kortingscode enkel in invoices.total.
// De regels bleven op de volle prijs staan, dus regels ≠ totaal. Odoo boekt de regels: de
// 15 Fonske-tickets van €0 kwamen als €309 omzet en €53,66 btw in de boekhouding.
//
// Regels die deze module garandeert (puur, getest in invoiceBuild.test.ts):
//   1. Het totaal van de factuur IS de som van de regels: subtotal = Σ netto, tax = Σ btw,
//      total = Σ bruto. Alles in centen afgerond, nooit meer decimalen.
//   2. Het betaalde bedrag (orders.total) is de waarheid. De korting wordt afgeleid als
//      (items + verzending − betaald), niet uit orders.discount_amount (oude imports hebben
//      een subtotaal dat al na korting is). Een verschil met discount_amount → waarschuwing.
//   3. De korting komt als negatieve regel per btw-tarief (line_type 'discount'), verdeeld
//      naar rato van het bedrag per tarief. Zo blijft de btw per tarief juist.
//   4. Btw per tarief zoals de FDM/kassa: btw = half-up(bruto × t / (100 + t)) op het totaal
//      van dat tarief (inclusief), of half-up(netto × t / 100) (exclusief). De regels tellen
//      exact op tot dat tariefbedrag; een afrondingsrest van centen gaat naar de kortingsregel
//      of, zonder korting, naar de grootste regel van dat tarief.
//   5. Betaalde de klant méér dan de items (verkeerde of ontbrekende orderregels), dan komt
//      er GEEN factuur: `refuse` met de reden. Dat moet een mens bekijken.
//   6. Wijkt het fiscale tarief af van het tarief waarmee de prijs berekend werd (btw
//      verlegd, export, OSS), dan wordt de prijs eerst met het oorspronkelijke tarief naar
//      netto omgerekend en daarop het fiscale tarief toegepast. Het factuurtotaal is dan
//      bewust niet gelijk aan het betaalde bedrag (zoals voordien); dat staat in `notes`.

export type VatHandling = "inclusive" | "exclusive";

export interface BuildItem {
  description: string;
  quantity: number;
  /** Bedrag van de regel zoals op de order: bruto bij inclusive, netto bij exclusive. */
  lineTotal: number;
  /** Tarief waarmee de prijs berekend werd (order_items.vat_rate, anders het tenanttarief). */
  origRate: number;
  /** Fiscaal tarief op de factuur (uit de regime-resolver). */
  fiscalRate: number;
  productId?: string | null;
  lineType?: "product" | "shipping";
  vatBoxCode?: string;
  glAccountCode?: string;
}

export interface BuildInput {
  vatHandling: VatHandling;
  items: BuildItem[];
  /**
   * Het bedrag dat de klant betaalde: orders.total. Verplicht bij inclusive. Bij exclusive
   * zonder betaling vooraf (manuele factuur) weglaten: dan geen vergelijking met betaald.
   */
  paidTotal?: number;
  /** orders.discount_amount, enkel ter controle. */
  declaredDiscount?: number;
  discountCode?: string | null;
  vatCategory: string;
}

export interface BuiltLine {
  description: string;
  quantity: number;
  unit_price: number;
  /** Netto (excl. btw). Ook in net_amount. */
  line_total: number;
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
  vat_rate: number;
  vat_category: string;
  line_type: "product" | "shipping" | "discount";
  product_id: string | null;
  sort_order: number;
  vat_box_code?: string;
  gl_account_code?: string;
}

export interface BuildResult {
  ok: true;
  lines: BuiltLine[];
  subtotal: number;
  tax: number;
  total: number;
  discount: number;
  breakdown: { vatRate: number; vatCategory: string; taxableAmount: number; vatAmount: number }[];
  warnings: string[];
  notes: string[];
}

export interface BuildRefusal {
  ok: false;
  reason: string;
}

/** Afronden op de cent, half weg van nul (1,005 → 1,01; −1,005 → −1,01). */
export function r2(x: number): number {
  const s = x < 0 ? -1 : 1;
  const cents = Math.round(Number((Math.abs(x) * 100).toFixed(6)));
  return (s * cents) / 100 || 0;
}

const cents = (x: number) => Math.round(r2(x) * 100);

/** Verdeel een bedrag in centen naar rato van gewichten (grootste rest), som exact. */
export function allocateCents(totalCents: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || totalCents === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (totalCents * w) / sum);
  const base = raw.map((x) => Math.floor(x));
  let rest = totalCents - base.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const o of order) {
    if (rest <= 0) break;
    base[o.i] += 1;
    rest -= 1;
  }
  return base;
}

export function buildInvoiceLines(input: BuildInput): BuildResult | BuildRefusal {
  const warnings: string[] = [];
  const notes: string[] = [];
  const items = input.items.filter((it) => r2(it.lineTotal) !== 0 || it.quantity !== 0);
  if (items.some((it) => it.lineTotal < 0)) {
    return { ok: false, reason: "orderregel met negatief bedrag" };
  }
  // Prijs zonder btw (checkout verlegde de btw of rekende export) maar de factuur zou btw
  // aanrekenen: het regime op de factuur verschilt van dat van de checkout. Nooit stil oplossen.
  if (input.vatHandling === "inclusive" && items.some((it) => it.origRate === 0 && it.fiscalRate > 0 && it.lineType !== "shipping")) {
    return { ok: false, reason: "orderregel zonder btw, maar het factuurregime rekent btw aan (regime nakijken, bv. btw-nummer of land)" };
  }

  // Alles in de prijsruimte van de order (bruto bij inclusive), in centen.
  const itemCents = items.map((it) => cents(it.lineTotal));
  const baseCents = itemCents.reduce((a, b) => a + b, 0);
  if (input.vatHandling === "inclusive" && (input.paidTotal === undefined || !Number.isFinite(input.paidTotal))) {
    return { ok: false, reason: "betaald bedrag ontbreekt" };
  }
  const paidCents = cents(input.paidTotal ?? 0);
  const discountCents = baseCents - paidCents;

  if (input.vatHandling === "inclusive") {
    if (discountCents < 0) {
      return {
        ok: false,
        reason: `betaald (${(paidCents / 100).toFixed(2)}) is meer dan de orderregels (${(baseCents / 100).toFixed(2)})`,
      };
    }
    const declared = cents(input.declaredDiscount ?? 0);
    if (declared !== discountCents) {
      warnings.push(
        `korting volgens de order ${(declared / 100).toFixed(2)}, afgeleid uit het betaalde bedrag ${(discountCents / 100).toFixed(2)}`,
      );
    }
  }

  // Groepen per fiscaal tarief + oorspronkelijk tarief (de omrekening hangt van beide af).
  type Group = { key: string; fiscal: number; orig: number; idx: number[] };
  const groups: Group[] = [];
  items.forEach((it, i) => {
    // Bij een inclusieve prijs met btw telt enkel het fiscale tarief (het bruto blijft); bv.
    // OSS: een BE 6%- en 21%-product naar NL 21% vormen samen één groep van 21%.
    const keepsGross = input.vatHandling === "inclusive" && (it.fiscalRate > 0 || it.origRate === 0);
    const key = keepsGross ? `${it.fiscalRate}|gross` : `${it.fiscalRate}|${it.origRate}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, fiscal: it.fiscalRate, orig: it.origRate, idx: [] };
      groups.push(g);
    }
    g.idx.push(i);
  });

  // Korting (bij inclusive afgeleid; bij exclusive uit de order, in netto) verdelen per groep.
  const discTotalCents = input.vatHandling === "inclusive" ? discountCents : cents(input.declaredDiscount ?? 0);
  const groupBase = groups.map((g) => g.idx.reduce((a, i) => a + itemCents[i], 0));
  if (discTotalCents > baseCents) return { ok: false, reason: "korting groter dan de orderregels" };
  // Een kortingscode verlaagt de producten, niet de verzending (zoals de checkout rekent).
  // Enkel wat de producten overstijgt, gaat naar de verzending.
  const isShip = (i: number) => items[i].lineType === "shipping";
  const groupProd = groups.map((g) => g.idx.filter((i) => !isShip(i)).reduce((a, i) => a + itemCents[i], 0));
  const groupShip = groups.map((g, gi) => groupBase[gi] - groupProd[gi]);
  const prodTotal = groupProd.reduce((a, b) => a + b, 0);
  const onProducts = allocateCents(Math.min(discTotalCents, prodTotal), groupProd);
  const onShipping = allocateCents(Math.max(0, discTotalCents - prodTotal), groupShip);
  const groupDisc = groups.map((_g, gi) => onProducts[gi] + onShipping[gi]);

  const lines: BuiltLine[] = [];
  let sort = 0;
  const pushLine = (l: Omit<BuiltLine, "sort_order">) => lines.push({ ...l, sort_order: sort++ });

  // Productregels in de oorspronkelijke volgorde, kortingsregels achteraan per groep.
  const lineVat: number[] = new Array(items.length).fill(0);
  const lineNet: number[] = new Array(items.length).fill(0);
  const lineGross: number[] = new Array(items.length).fill(0);
  const discLines: { g: Group; net: number; vat: number; gross: number }[] = [];

  groups.forEach((g, gi) => {
    // Inclusieve prijs met btw: het bruto blijft wat de klant betaalde, de btw zit erin aan
    // het fiscale tarief (ook bij OSS: de bestemmingsbtw zit in hetzelfde bruto). Enkel bij
    // een fiscaal 0%-regime op een bruto prijs (export, btw verlegd) wordt naar netto
    // omgerekend met het oorspronkelijke tarief.
    if (input.vatHandling === "inclusive" && (g.fiscal > 0 || g.orig === 0)) {
      if (g.orig !== g.fiscal) notes.push(`btw ${g.fiscal}% berekend op het betaalde bruto (prijs met ${g.orig}%)`);
      const grossGroup = groupBase[gi] - groupDisc[gi];
      const vatGroup = cents((grossGroup / 100) * g.fiscal / (100 + g.fiscal));
      let vatSum = 0;
      for (const i of g.idx) {
        const v = cents((itemCents[i] / 100) * g.fiscal / (100 + g.fiscal));
        lineVat[i] = v;
        lineGross[i] = itemCents[i];
        lineNet[i] = itemCents[i] - v;
        vatSum += v;
      }
      settle(g, groupDisc[gi], vatGroup - vatSum, false);
    } else {
      // Naar netto (met het oorspronkelijke tarief bij inclusive), dan het fiscale tarief.
      if (input.vatHandling === "inclusive") {
        notes.push(`prijs met ${g.orig}% omgerekend naar netto voor fiscaal ${g.fiscal}%: totaal wijkt bewust af van het betaalde bedrag`);
      }
      const toNet = (c: number) => (input.vatHandling === "inclusive" && g.orig > 0 ? cents((c / 100) / (1 + g.orig / 100)) : c);
      const netItems = g.idx.map((i) => toNet(itemCents[i]));
      const netBase = netItems.reduce((a, b) => a + b, 0);
      // De korting in netto: zelfde verhouding als in de prijsruimte.
      const netDisc = groupBase[gi] > 0 ? Math.round((groupDisc[gi] * netBase) / groupBase[gi]) : 0;
      const netGroup = netBase - netDisc;
      const vatGroup = cents((netGroup / 100) * g.fiscal / 100);
      let vatSum = 0;
      g.idx.forEach((i, k) => {
        const v = cents((netItems[k] / 100) * g.fiscal / 100);
        lineNet[i] = netItems[k];
        lineVat[i] = v;
        lineGross[i] = netItems[k] + v;
        vatSum += v;
      });
      settle(g, netDisc, vatGroup - vatSum, true);
    }
  });

  /**
   * Kortingsregel (of afrondingsrest) van een groep. `disc` is het kortingsbedrag in de
   * ruimte van de groep (bruto bij inclusive-zelfde-tarief, anders netto); `vatRest` is
   * wat de regels samen nog moeten bijdragen om op het btw-bedrag van de groep te komen.
   */
  function settle(g: Group, disc: number, vatRest: number, discIsNet: boolean) {
    let rest = vatRest;
    if (disc > 0) {
      // De kortingsregel krijgt nooit positieve btw of positief netto: de btw ligt tussen
      // −korting en 0. Wat overblijft (enkel bij centen-afrondingen) gaat naar de grootste regel.
      const vat = discIsNet ? Math.min(0, rest) : Math.min(0, Math.max(-disc, rest));
      rest -= vat;
      const gross = discIsNet ? -disc + vat : -disc;
      const net = discIsNet ? -disc : gross - vat;
      discLines.push({ g, net, vat, gross });
    }
    if (rest !== 0) {
      const prods = g.idx.filter((i) => !isShip(i));
      const pool = prods.length ? prods : g.idx;
      const target = pool.reduce((best, i) => (itemCents[i] > itemCents[best] ? i : best), pool[0]);
      lineVat[target] += rest;
      if (discIsNet) lineGross[target] += rest;
      else lineNet[target] -= rest;
      if (Math.abs(rest) > g.idx.length) warnings.push(`afrondingsrest ${rest} cent op tarief ${g.fiscal}%`);
    }
  }

  items.forEach((it, i) => {
    const net = lineNet[i] / 100;
    const qty = Number(it.quantity) || 1;
    pushLine({
      description: it.description,
      quantity: qty,
      unit_price: Number((net / qty).toFixed(4)),
      line_total: net,
      net_amount: net,
      vat_amount: lineVat[i] / 100,
      gross_amount: lineGross[i] / 100,
      vat_rate: it.fiscalRate,
      vat_category: input.vatCategory,
      line_type: it.lineType ?? "product",
      product_id: it.productId ?? null,
      ...(it.vatBoxCode ? { vat_box_code: it.vatBoxCode } : {}),
      ...(it.glAccountCode ? { gl_account_code: it.glAccountCode } : {}),
    });
  });

  const multiRate = new Set(discLines.map((d) => d.g.fiscal)).size > 1;
  const label = input.discountCode ? `Korting (${input.discountCode})` : "Korting";
  for (const d of discLines) {
    const ref = items[d.g.idx[0]];
    pushLine({
      description: multiRate ? `${label} — ${d.g.fiscal}%` : label,
      quantity: 1,
      unit_price: d.net / 100,
      line_total: d.net / 100,
      net_amount: d.net / 100,
      vat_amount: d.vat / 100,
      gross_amount: d.gross / 100,
      vat_rate: d.g.fiscal,
      vat_category: input.vatCategory,
      line_type: "discount",
      product_id: null,
      ...(ref.vatBoxCode ? { vat_box_code: ref.vatBoxCode } : {}),
      ...(ref.glAccountCode ? { gl_account_code: ref.glAccountCode } : {}),
    });
  }

  const sumC = (f: (l: BuiltLine) => number) => lines.reduce((a, l) => a + cents(f(l)), 0) / 100;
  const subtotal = sumC((l) => l.net_amount);
  const tax = sumC((l) => l.vat_amount);
  const total = sumC((l) => l.gross_amount);

  // Zelfcontrole: netto + btw = bruto per regel en in totaal.
  for (const l of lines) {
    if (cents(l.net_amount) + cents(l.vat_amount) !== cents(l.gross_amount)) {
      return { ok: false, reason: `interne fout: regel "${l.description}" netto + btw ≠ bruto` };
    }
  }
  if (input.vatHandling === "exclusive" && input.paidTotal !== undefined && cents(total) !== paidCents) {
    warnings.push(`factuurtotaal ${total.toFixed(2)} ≠ betaald ${(paidCents / 100).toFixed(2)} (exclusieve prijzen)`);
  }
  const converted = notes.some((n) => n.includes("omgerekend naar netto"));
  if (input.vatHandling === "inclusive" && !converted && cents(total) !== paidCents) {
    return { ok: false, reason: `interne fout: factuurtotaal ${total.toFixed(2)} ≠ betaald ${(paidCents / 100).toFixed(2)}` };
  }

  const bmap = new Map<number, { vatRate: number; vatCategory: string; taxableAmount: number; vatAmount: number }>();
  for (const l of lines) {
    const b = bmap.get(l.vat_rate) ?? { vatRate: l.vat_rate, vatCategory: l.vat_category, taxableAmount: 0, vatAmount: 0 };
    b.taxableAmount = (cents(b.taxableAmount) + cents(l.net_amount)) / 100;
    b.vatAmount = (cents(b.vatAmount) + cents(l.vat_amount)) / 100;
    bmap.set(l.vat_rate, b);
  }

  return {
    ok: true,
    lines,
    subtotal,
    tax,
    total,
    discount: discTotalCents / 100,
    breakdown: Array.from(bmap.values()).sort((a, b) => b.vatRate - a.vatRate),
    warnings,
    notes,
  };
}
