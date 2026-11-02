// QR-MODULES-1 — variant via ?v=… : order | check | check-nostripe | fiscal | view | kassa | oldapi
const q = new URLSearchParams(location.search);
export const V = q.get('v') ?? 'check';
export const STRIPE = !['order', 'check-nostripe'].includes(V);
