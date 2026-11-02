import { useCard } from './ctx';
export function useUsageLimits() {
  const s = useCard();
  return { checkFeature: (k: string) => (k === 'odoo_sync' ? s.access : false) };
}
