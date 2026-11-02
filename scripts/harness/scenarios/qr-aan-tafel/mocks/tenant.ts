import { STRIPE } from './h';
const t = { id: 't1', name: 'Café De Wissel', slug: 'demo-bar', currency: 'EUR', language: 'nl', country: 'BE', tax_percentage: 21, iban: 'BE68539007547034', stripe_charges_enabled: STRIPE };
export function useTenant() { return { currentTenant: t, tenants: [t], setCurrentTenant: () => {}, loading: false }; }
export function useAuth() { return { user: { id: 'u1', email: 'zaak@dewissel.be' }, signOut: () => {}, isPlatformAdmin: false, roles: [] }; }
