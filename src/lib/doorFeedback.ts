// EVENT-SCAN-1 — voelbare en hoorbare feedback voor de scanner aan de deur.
// Geluid via WebAudio (geen bestand nodig); de AudioContext wordt pas gemaakt na een tik
// van de gebruiker, anders blijft hij op iOS stil. Trillen via navigator.vibrate (Android;
// iOS Safari ondersteunt het niet, daar blijft het bij geluid en kleur).
// Scherm-aan via de Wake Lock API, met herstel als de pagina terug zichtbaar wordt.

export type DoorTone = 'ok' | 'warn' | 'error';

let ctx: AudioContext | null = null;

export function unlockDoorAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) ctx = new AC();
    }
    void ctx?.resume();
  } catch { /* geen geluid, geen probleem */ }
}

function beep(freq: number, start: number, dur: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.02);
}

export function doorFeedback(tone: DoorTone, sound = true) {
  try {
    if (tone === 'ok') navigator.vibrate?.(70);
    else if (tone === 'warn') navigator.vibrate?.([90, 60, 90]);
    else navigator.vibrate?.([220, 90, 220]);
  } catch { /* noop */ }
  if (!sound) return;
  try {
    if (tone === 'ok') { beep(1320, 0, 0.12); }
    else if (tone === 'warn') { beep(660, 0, 0.12); beep(660, 0.18, 0.12); }
    else { beep(220, 0, 0.32); }
  } catch { /* noop */ }
}

type Sentinel = { release: () => Promise<void> };

export function keepScreenOn(): () => void {
  let sentinel: Sentinel | null = null;
  let stopped = false;
  const request = async () => {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock;
      if (wl && document.visibilityState === 'visible' && !stopped) sentinel = await wl.request('screen');
    } catch { /* niet ondersteund of geweigerd */ }
  };
  const onVisible = () => { if (document.visibilityState === 'visible') void request(); };
  void request();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    void sentinel?.release().catch(() => undefined);
  };
}
