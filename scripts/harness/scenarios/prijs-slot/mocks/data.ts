// PRIJS-GATEN-1 harnas — één product met twee varianten; de rol komt uit ?role= (standaard warehouse).
export const role = new URLSearchParams(location.search).get('role') ?? 'warehouse';
const now = new Date().toISOString();
export const variants = [
  { id: 'v1', product_id: 'p1', tenant_id: 't1', title: 'Groot', sku: 'PZ-G', barcode: null, price: 14, compare_at_price: 16, cost_price: 5, stock: 3, track_inventory: true, is_active: true, image_url: null, images: [], attribute_values: { Maat: 'Groot' }, weight: null, position: 0, linked_product_id: null, created_at: now, updated_at: now },
  { id: 'v2', product_id: 'p1', tenant_id: 't1', title: 'Klein', sku: 'PZ-K', barcode: null, price: 10, compare_at_price: null, cost_price: 3.5, stock: 7, track_inventory: true, is_active: true, image_url: null, images: [], attribute_values: { Maat: 'Klein' }, weight: null, position: 1, linked_product_id: null, created_at: now, updated_at: now },
];
export const options = [{ id: 'o1', product_id: 'p1', tenant_id: 't1', name: 'Maat', values: ['Groot', 'Klein'], position: 0, created_at: now, updated_at: now }];
export const products = [
  { id: 'p1', tenant_id: 't1', name: 'Pizza Margherita', sku: 'PZ', price: 12, cost_price: 4, compare_at_price: null, stock: 10, category_id: null, vat_rate_id: 'vat6', is_active: true, track_inventory: true, tags: [], images: [] },
  { id: 'p2', tenant_id: 't1', name: 'Tiramisu', sku: 'TI', price: 6.5, cost_price: 2, compare_at_price: 7.5, stock: 4, category_id: null, vat_rate_id: 'vat6', is_active: true, track_inventory: true, tags: [], images: [] },
];
const w = window as unknown as { __updates: unknown[] };
w.__updates = [];
export const updates = w.__updates;
