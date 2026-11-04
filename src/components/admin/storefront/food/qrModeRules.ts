// HORECA-NU-1 — één regel, gedeeld door QR aan tafel (QrModeSettings) en de tegel "Bestellen via QR" op het
// Nu-paneel: bestellen aan tafel met "elke bestelling apart afrekenen" moet minstens één betaalwijze hebben
// (aan de toog of meteen online). Op de tafelrekening betaalt de gast op het einde: geen keuze nodig.
import type { QrMode } from './qrModes';

export interface QrPayRuleInput { mode: QrMode; flow: 'order' | 'check'; counter: boolean; payOnline: boolean }

/** true = deze stand laat de gast bestellen zonder enige manier om te betalen (niet bewaren). */
export const qrOrderHasNoPayWay = (s: QrPayRuleInput) => s.mode === 'order' && s.flow === 'order' && !s.counter && !s.payOnline;
