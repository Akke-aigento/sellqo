const t = { id: 't1', name: 'Belgaleiro (test)' };
export function useTenant() { return { currentTenant: t, tenants: [t], setCurrentTenant: () => {}, loading: false }; }
