import { useCan, useScopedRoles } from '@/hooks/useCan';

/** Prijs- en btw-velden van een product (DB: guard_product_commercial_fields, default-deny). */
export const PRODUCT_PRICE_FIELDS = new Set(['price', 'compare_at_price', 'cost_price', 'vat_rate_id', 'takeaway_vat_rate_id']);
/** Artikelcodes: voor marketing/warehouse geweigerd door dezelfde guard. */
export const PRODUCT_CODE_FIELDS = new Set(['sku', 'barcode']);
/** Voorraadvelden: enkel warehouse binnen de beperkte rollen. */
export const PRODUCT_STOCK_FIELDS = new Set(['stock', 'low_stock_threshold']);
/** Prijsvelden van een variant (DB: guard_product_variant_price_fields). */
export const VARIANT_PRICE_FIELDS = new Set(['price', 'compare_at_price', 'cost_price']);

/**
 * PRIJS-GATEN-1 — welke productvelden de gebruiker in de actieve winkel mag wijzigen, zoals de
 * DB-guards het afdwingen. Zo toont het scherm een veld alleen-lezen in plaats van pas bij
 * opslaan een databasefout te geven.
 *
 * - Prijzen, btw, sku en barcode: enkel tenant_admin/staff (en platform_admin) — `product_prices`.
 * - Voorraad (veld): iedereen behalve een rol die enkel marketing is (PROD-TRIGGER-1).
 * - Voorraad bijstellen op het scherm (`canAdjustStock`): wie producten mag bewerken of warehouse is,
 *   en niet enkel marketing. Viewer en accountant krijgen geen +/−.
 */
export function useProductFieldAccess(): { canEditCommercial: boolean; canEditStock: boolean; canAdjustStock: boolean } {
  const canEditCommercial = useCan('write', 'product_prices');
  const canWriteProducts = useCan('write', 'products');
  const roles = useScopedRoles();
  const isWarehouse = !!roles?.includes('warehouse');
  const restricted = !canEditCommercial && !!roles?.some((r) => r === 'marketing' || r === 'warehouse');
  const canEditStock = !restricted || isWarehouse;
  const canAdjustStock = canEditStock && (canWriteProducts || isWarehouse);
  return { canEditCommercial, canEditStock, canAdjustStock };
}
