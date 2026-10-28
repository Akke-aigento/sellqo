// MELDING-1 — geluid en scherm wakker op de kassa: per toestel bewaard (deze browser/app), standaard
// aan want de kassa staat open in de zaak. Beheerd boven het PIN-scherm (KassaLive in KassaApp.tsx).
export const KASSA_SOUND_KEY = 'sq_kassa_sound';
export const KASSA_WAKE_KEY = 'sq_kassa_wake';

export interface KassaAlerts { sound: boolean; setSound: (v: boolean) => void; wake: boolean; setWake: (v: boolean) => void; wakeActive: boolean }
