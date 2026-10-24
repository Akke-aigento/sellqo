// TAFEL-3 — kleine voorkeuren van de toog, per toestel onthouden (gemak, geen data):
// laatst gekozen "ter plaatse / meenemen" en of er een keukenbon gemaakt wordt.
export type CounterService = 'eat_in' | 'takeaway';

const SERVICE_KEY = 'sq_kassa_counter_service';
const KITCHEN_KEY = 'sq_kassa_counter_kitchen';

export function lastService(): CounterService {
  try { return localStorage.getItem(SERVICE_KEY) === 'takeaway' ? 'takeaway' : 'eat_in'; } catch { return 'eat_in'; }
}
export function rememberService(s: CounterService) {
  try { localStorage.setItem(SERVICE_KEY, s); } catch { /* privémodus */ }
}
export function kitchenOn(): boolean {
  try { return localStorage.getItem(KITCHEN_KEY) !== 'off'; } catch { return true; }
}
export function rememberKitchen(on: boolean) {
  try { localStorage.setItem(KITCHEN_KEY, on ? 'on' : 'off'); } catch { /* privémodus */ }
}
