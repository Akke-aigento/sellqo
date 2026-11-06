const t = { id: 't1', name: 'Brasserie Belgaleiro', slug: 'belgaleiro', currency: 'EUR', language: 'nl', country: 'BE', tax_percentage: 21,
  address: 'Bondgenotenlaan 12', postal_code: '3000', city: 'Leuven', phone: '016 12 34 56', logo_url: null };
export function useTenant() { return { currentTenant: t, tenants: [t], setCurrentTenant: () => {}, loading: false, refreshTenants: async () => {} }; }
export const TenantContext = null;
