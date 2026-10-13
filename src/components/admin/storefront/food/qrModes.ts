// HORECA-1 — standen van het QR-menu (gedeeld door instellingen en Bestellen-overzicht).
export type QrMode = 'off' | 'view' | 'order';
// Labels als i18n-key; `value` blijft de enum-waarde.
export const QR_MODES: { value: QrMode; titleKey: string; textKey: string }[] = [
  { value: 'off', titleKey: 'admin.orderingHub.qr_off', textKey: 'admin.orderingHub.qr_off_text' },
  { value: 'view', titleKey: 'admin.orderingHub.qr_view', textKey: 'admin.orderingHub.qr_view_text' },
  { value: 'order', titleKey: 'admin.orderingHub.qr_order', textKey: 'admin.orderingHub.qr_order_text' },
];
