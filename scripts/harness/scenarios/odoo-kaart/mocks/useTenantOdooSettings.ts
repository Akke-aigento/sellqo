import { useCard } from './ctx';
export function useTenantOdooSettings() {
  const s = useCard();
  return { settings: { odoo_sync_enabled: s.sync } };
}
