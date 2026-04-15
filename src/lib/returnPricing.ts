/**
 * Berekent de werkelijke (post-discount) prijs per item.
 * 
 * Bij orders met korting wordt de korting proportioneel verdeeld over alle items.
 * Voorbeeld: order subtotaal €110, korting €108.90 → ratio = (110-108.90)/110 = 0.01
 * Item prijs €110 → werkelijke prijs = €110 * 0.01 = €1.10
 * 
 * @param unitPrice - Catalogusprijs per stuk
 * @param orderSubtotal - Order subtotaal (som van alle items vóór korting)
 * @param orderDiscountAmount - Totale korting op de order
 * @returns Werkelijke prijs per stuk na proportionele korting
 * 
 * @example
 * // Order #0006: subtotaal €110, korting €108.90
 * calculateActualItemPrice(110, 110, 108.90) // → 1.10
 * 
 * // Zonder korting
 * calculateActualItemPrice(25.99, 51.98, 0) // → 25.99
 */
export function calculateActualItemPrice(
  unitPrice: number,
  orderSubtotal: number | null | undefined,
  orderDiscountAmount: number | null | undefined
): number {
  const discount = Number(orderDiscountAmount) || 0;
  const subtotal = Number(orderSubtotal) || 0;

  if (!subtotal || subtotal === 0 || discount === 0) return unitPrice;

  const discountRatio = (subtotal - discount) / subtotal;
  return Math.round(unitPrice * discountRatio * 100) / 100;
}

/**
 * Berekent het standaard refund bedrag voor een retouritem.
 */
export function calculateItemRefundAmount(
  quantity: number,
  actualUnitPrice: number,
  restockingFeePerUnit: number
): number {
  return Math.max(0, Math.round((quantity * actualUnitPrice - restockingFeePerUnit * quantity) * 100) / 100);
}
