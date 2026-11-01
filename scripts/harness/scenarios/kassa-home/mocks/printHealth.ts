// KEUKEN-VEILIG-1: één bon niet afgedrukt en de barprinter zonder verbinding.
export { hasPrintProblem, printHealth } from '@/components/horeca/printHealth';
export function usePrintHealth() {
  return { data: { failed: 1, stuck: 0, offline: ['Bar'], latestMs: Date.now() } };
}
