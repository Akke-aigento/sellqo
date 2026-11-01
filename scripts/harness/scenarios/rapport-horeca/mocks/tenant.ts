const t = { id: 't1', name: 'Café De Wissel' };
export function useTenant() { return { currentTenant: t, tenants: [t], setCurrentTenant: () => {}, loading: false }; }
