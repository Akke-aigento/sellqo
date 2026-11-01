export type ClockDirection = 'in' | 'out';
export const isClockedIn = () => true;
// PERSONEEL-2: de knopstand komt van de server.
export const fetchClockState = async () => true;
export const clock = async () => ({ ok: true, clockedIn: false });
