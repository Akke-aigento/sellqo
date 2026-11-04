const t = { id: 't1', name: 'Café De Wissel', slug: 'demo-bar', currency: 'EUR', language: 'nl', country: 'BE', tax_percentage: 21 };
// UREN-1c: Branding herlaadt de zaak na het bewaren (refreshTenants).
const refreshTenants = async () => {};
export function useTenant() { return { currentTenant: t, tenants: [t], setCurrentTenant: () => {}, loading: false, refreshTenants }; }
