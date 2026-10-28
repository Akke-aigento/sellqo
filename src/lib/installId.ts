// MELDING-1 — vaste ID van deze installatie (browser, beginscherm-app of native app).
//
// Een push-token kan vernieuwen; het meldingsprofiel van een toestel (horeca_notify_devices) moet
// blijven. Daarom hangt het profiel aan deze ID, die bij elke registratie mee in device_tokens gaat.
// Een beginscherm-app op iOS heeft een eigen opslag en dus een eigen ID: dat is ook een eigen toestel.
const KEY = 'sq_install_id';
let memo: string | null = null;

export function getInstallId(): string {
  if (memo) return memo;
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && /^[A-Za-z0-9-]{8,64}$/.test(existing)) return (memo = existing);
    const fresh = crypto.randomUUID();
    localStorage.setItem(KEY, fresh);
    return (memo = fresh);
  } catch {
    // Geen opslag (privévenster): een ID voor deze sessie. Het profiel overleeft dan geen herstart.
    return (memo = memo ?? crypto.randomUUID());
  }
}
