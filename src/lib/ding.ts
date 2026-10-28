// Kort belletje met WebAudio (geen bestand nodig) — keukenscherm (FOOD-2) en kassa (MELDING-1).
// Een browser speelt pas geluid na een tik op de pagina; daarom zet een schakelaar "geluid aan"
// altijd meteen een belletje af, en hervat elke tik de (ene, gedeelde) audiocontext.
let shared: AudioContext | null = null;
let unlockBound = false;

function context(): AudioContext | null {
  try {
    if (!shared) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      shared = new Ctx();
    }
    // Safari laat een context "suspended" tot een tik: één gedeelde context, bij elke tik hervat.
    if (!unlockBound) {
      unlockBound = true;
      const unlock = () => { void shared?.resume().catch(() => undefined); };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock);
    }
    if (shared.state === 'suspended') void shared.resume().catch(() => undefined);
    return shared;
  } catch {
    return null;
  }
}

export function ding(): void {
  const ctx = context();
  if (ctx) {
    try {
      [0, 0.18].forEach((t, i) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = i ? 1320 : 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.5);
        o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.55);
      });
    } catch { /* geen audio beschikbaar */ }
  }
  try { navigator.vibrate?.([120, 80, 120]); } catch { /* geen trilfunctie */ }
}

/** Aan/uit per toestel, bewaard in deze browser. `fallback` = de stand als er nog niets bewaard is. */
export function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

export function writeFlag(key: string, on: boolean): void {
  try { localStorage.setItem(key, on ? '1' : '0'); } catch { /* privémodus */ }
}
