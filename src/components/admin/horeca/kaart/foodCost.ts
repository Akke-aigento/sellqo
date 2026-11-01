// KAART-MARGE-1 — foodcost op de Kaart: kostprijs / verkoopprijs excl. btw.
// Zelfde rekenregel als de marge op het productformulier (PRODUCT-FORM-2): de verkoopprijs is incl.
// btw, de kostprijs (products.cost_price) excl. btw. Btw-tarief zoals de kassa het neemt: het tarief
// van het product (ter plaatse), anders het standaardtarief van de zaak.

/** Boven deze foodcost kleurt de Kaart het getal (vuistregel horeca: ±30-35 %). */
export const FOODCOST_WARN_PCT = 35;

/** Foodcost in procent, of null als kostprijs of verkoopprijs ontbreekt. */
export function foodCostPct(priceIncl: number, cost: number | null | undefined, vatRate: number): number | null {
  if (cost === null || cost === undefined || !Number.isFinite(cost) || cost <= 0) return null;
  if (!Number.isFinite(priceIncl) || priceIncl <= 0) return null;
  const net = priceIncl / (1 + (Number.isFinite(vatRate) ? vatRate : 0) / 100);
  return (cost / net) * 100;
}

export const isFoodCostHigh = (pct: number | null) => pct !== null && pct > FOODCOST_WARN_PCT;

/** Afgerond voor weergave: "32 %" (geen valse precisie). */
export const foodCostLabel = (pct: number) => `${Math.round(pct)} %`;
