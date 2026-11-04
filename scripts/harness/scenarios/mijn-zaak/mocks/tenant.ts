import { createContext } from 'react';
const t = { id: 't1', name: 'Café De Wissel', slug: 'demo-bar', currency: 'EUR', language: 'nl', country: 'BE', tax_percentage: 21,
  address: 'Markt 1', postal_code: '3000', city: 'Leuven', btw_number: 'BE0123456789', logo_url: null, stripe_charges_enabled: false };
const ctx = { currentTenant: t, tenants: [t], setCurrentTenant: () => {}, loading: false, refreshTenants: async () => {} };
export const TenantContext = createContext<unknown>(ctx);
export function TenantProvider({ children }: { children: unknown }) { return children; }
export function useTenant() { return ctx; }
