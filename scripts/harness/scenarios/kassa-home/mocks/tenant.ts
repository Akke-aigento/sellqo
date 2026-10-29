const t = { id: 't1', name: 'Café De Wissel', slug: 'demo-bar', currency: 'EUR', language: 'nl' };
export function useTenant() { return { currentTenant: t, tenants: [t], setCurrentTenant: () => {}, loading: false }; }
