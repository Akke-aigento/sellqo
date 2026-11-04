const t = { id: 't1', name: 'Café De Wissel', slug: 'demo-bar', currency: 'EUR', language: 'nl', country: 'BE', tax_percentage: 21, stripe_charges_enabled: true };
export function useTenant() { return { currentTenant: t, tenants: [t], setCurrentTenant: () => {}, loading: false, refreshTenants: async () => {} }; }
export const TenantContext = null;
