// ZIJBALK-BESTELLINGEN-1 — staat online bestellen (afhalen, leveren) aan voor deze zaak?
//
// Dezelfde rijen en dezelfde regels als storefront-api (_shared/orderingState.ts, `online`), zodat de
// zijbalk en de website nooit iets anders zeggen:
//   - tenant_theme_settings.shop_live = false  → dicht ('shop_offline')
//   - tenant_theme_settings.shop_ordering = false → dicht ('ordering_off')
//   - geen actieve shipping_methods-rij        → dicht ('no_methods')
// Een eigen frontend (use_custom_frontend) negeert shop_live/shop_ordering, net als de storefront-api;
// zonder tenant_theme_settings-rij geldt geen beperking (idem).
//
// Bewust NIET overgenomen: wat met het uur verandert (vandaag dicht, keukenpauze, buiten de uren, tijdsloten
// zonder uren). Een menu-item dat 's avonds tijdens een pauze verdwijnt en weer opduikt, helpt niemand.
// Puur, zodat het getest kan worden.

export interface OnlineOrdersInput {
  /** tenant_theme_settings.use_custom_frontend */
  customFrontend?: boolean | null;
  /** tenant_theme_settings.shop_live; null = geen rij (geen beperking). */
  shopLive?: boolean | null;
  /** tenant_theme_settings.shop_ordering; null = geen rij (geen beperking). */
  shopOrdering?: boolean | null;
  /** fulfillment_type van de actieve shipping_methods (pickup, local_delivery, shipping). */
  methods: readonly string[];
}

/** Kan een gast nu (los van het uur) online bestellen? Zelfde uitkomst als ordering_state.online van de storefront-api. */
export function onlineOrdersOn(i: OnlineOrdersInput): boolean {
  if (!i.customFrontend) {
    if (i.shopLive === false) return false;
    if (i.shopOrdering === false) return false;
  }
  return i.methods.length > 0;
}

/**
 * Bestellingen in de horeca-only-zijbalk: enkel als online bestellen aan staat, of als er al bestellingen
 * zijn (oude online orders mogen niet uit zicht verdwijnen). Tafel-QR gaat naar de tafelrekening, niet
 * naar orders.
 */
export function showOrdersInHorecaSidebar(i: OnlineOrdersInput & { hasOrders: boolean }): boolean {
  return onlineOrdersOn(i) || i.hasOrders;
}
