// HORECA-NU-1 — Café De Wissel: kaart, zones en instellingen (rustig of druk).
import { druk, pauze } from './h';
const inMin = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const tomorrow5 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(5, 0, 0, 0); return d.toISOString(); };
export const today = new Date().toISOString().slice(0, 10);
const p = (id: string, name: string, price: number, category_id: string, menu_position: number, extra: Record<string, unknown> = {}) => ({
  id, name, price, category_id, menu_position, is_active: true, channels: null, sold_out_until: null, vat_rate_id: null, takeaway_vat_rate_id: null,
  short_description: null, allergens: [], featured_image: null, images: [], cost_price: null, hide_from_storefront: false, product_type: 'physical', ...extra,
});
export const products = [
  p('p1', 'Tomatensoep', 5.5, 'c1', 1, druk ? { daily_special_until: tomorrow5() } : {}),
  p('p2', 'Stoofvlees met frietjes', 18.5, 'c2', 1, druk ? { daily_special_until: tomorrow5() } : {}),
  p('p3', 'Vol-au-vent', 17, 'c2', 2, druk ? { sold_out_until: tomorrow5() } : {}),
  p('p4', 'Croque monsieur', 9.5, 'c2', 3),
  p('p5', 'Spaghetti bolognese', 14, 'c2', 4, druk ? { sold_out_until: tomorrow5() } : {}),
  p('p6', 'Pils 25 cl', 2.8, 'c3', 1),
  p('p7', 'Duvel', 4.8, 'c3', 2),
  p('p8', 'Dame blanche', 7.5, 'c4', 1),
  // HORECA-NU-1b: enkel aan de kassa (geen menu/table) en verborgen op de site → nooit dagschotel te kiezen.
  p('p9', 'Personeelsmaaltijd', 6, 'c2', 5, { channels: ['pos'] }),
  p('p10', 'Oude wafel', 3, 'c4', 2, { hide_from_storefront: true }),
];
export const categories = [
  { id: 'c1', name: 'Soepen', sort_order: 0, is_active: true, default_vat_rate_id: null, default_takeaway_vat_rate_id: null },
  { id: 'c2', name: 'Hoofdgerechten', sort_order: 1, is_active: true, default_vat_rate_id: null, default_takeaway_vat_rate_id: null },
  { id: 'c3', name: 'Dranken', sort_order: 2, is_active: true, default_vat_rate_id: null, default_takeaway_vat_rate_id: null },
  { id: 'c4', name: 'Desserts', sort_order: 3, is_active: true, default_vat_rate_id: null, default_takeaway_vat_rate_id: null },
];
export const areas = [
  { id: 'a1', name: 'Zaal', sort: 0, grid_w: 20, grid_h: 12, is_active: true, is_open: true },
  { id: 'a2', name: 'Terras', sort: 1, grid_w: 20, grid_h: 10, is_active: true, is_open: !druk },
];
export const pausedUntil = druk || pauze ? inMin(20) : null;
export const closures = druk ? [{ from: today, to: today, reason: 'Personeel ziek' }] : [];
