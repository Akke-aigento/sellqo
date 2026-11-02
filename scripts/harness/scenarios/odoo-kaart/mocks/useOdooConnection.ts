import { useCard } from './ctx';
export function useOdooConnection() {
  const s = useCard();
  return { status: { data: s.configured ? { configured: true, connected_version: '18.0', last_test_at: new Date(Date.now() - 3 * 3600_000).toISOString() } : { configured: false } } };
}
