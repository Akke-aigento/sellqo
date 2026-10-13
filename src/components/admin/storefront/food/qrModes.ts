// HORECA-1 — standen van het QR-menu (gedeeld door instellingen en Bestellen-overzicht).
export type QrMode = 'off' | 'view' | 'order';
export const QR_MODES: { value: QrMode; title: string; text: string }[] = [
  { value: 'off', title: 'Uit', text: 'Geen menukaart op /menu' },
  { value: 'view', title: 'Alleen bekijken', text: 'Digitale menukaart, bestellen doe je bij de bediening' },
  { value: 'order', title: 'Bestellen aan tafel', text: 'Klanten bestellen via de QR-code; de keuken krijgt het meteen, met tafelnummer' },
];
