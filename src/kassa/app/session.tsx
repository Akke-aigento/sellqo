// PERSONEEL-1 — wie staat er aan de kassa (USR-01).
// Geen enkele handeling zonder aangemelde medewerker: na inactiviteit of "Wissel" valt de
// kassa terug op het PIN-scherm. Het INSZ (employeeId) leeft enkel in het geheugen van
// deze sessie, nooit in opslag of op het scherm.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface KassaStaff {
  id: string;
  display_name: string;
  role: string;
  employee_no: number | null;
  avatar_color: string | null;
}

export interface KassaSessionValue {
  staff: KassaStaff | null;
  /** INSZ voor de FDM-berichten; null = niet ingesteld (fiscale handelingen geweigerd). */
  employeeId: string | null;
  signIn: (staff: KassaStaff, employeeId: string | null) => void;
  lock: () => void;
  /**
   * KASSA-UX-3: scherm aan de muur (Keuken, Bar) — niet vergrendelen bij inactiviteit. Tikken in die
   * modus telt niet als activiteit: wie na de wachttijd iets registreert of naar Zaal gaat, geeft eerst zijn PIN.
   */
  setIdlePaused: (paused: boolean) => void;
  /** True = de medewerker mag verder; false = te lang inactief, de kassa is nu vergrendeld (PIN). */
  guard: () => boolean;
}

const Ctx = createContext<KassaSessionValue | null>(null);

export const DEFAULT_IDLE_MS = 2 * 60_000;

export function KassaSessionProvider({ children, idleMs = DEFAULT_IDLE_MS }: { children: ReactNode; idleMs?: number }) {
  const [staff, setStaff] = useState<KassaStaff | null>(null);
  const employeeIdRef = useRef<string | null>(null);
  const [, force] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const lastActive = useRef(Date.now());

  const lock = useCallback(() => {
    employeeIdRef.current = null;
    setStaff(null);
  }, []);

  const signIn = useCallback((s: KassaStaff, employeeId: string | null) => {
    employeeIdRef.current = employeeId;
    lastActive.current = Date.now();
    setStaff(s);
    force((x) => x + 1);
  }, []);

  // Inactiviteit = vergrendelen. Elke tik, toets of scroll houdt de sessie open.
  useEffect(() => {
    if (!staff || idleMs <= 0) return;
    if (paused) return; // Keuken/Bar: geen tijdslot; guard() bewaakt het verlaten.
    lastActive.current = Date.now();
    let timer = window.setTimeout(lock, idleMs);
    const bump = () => { lastActive.current = Date.now(); window.clearTimeout(timer); timer = window.setTimeout(lock, idleMs); };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, bump, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, bump);
    };
  }, [staff, idleMs, lock, paused]);

  const setIdlePaused = useCallback((p: boolean) => { pausedRef.current = p; setPaused(p); }, []);
  const guard = useCallback(() => {
    if (idleMs > 0 && Date.now() - lastActive.current >= idleMs) { lock(); return false; }
    if (!pausedRef.current) lastActive.current = Date.now();
    return true;
  }, [idleMs, lock]);

  const value = useMemo<KassaSessionValue>(() => ({ staff, employeeId: employeeIdRef.current, signIn, lock, setIdlePaused, guard }), [staff, signIn, lock, setIdlePaused, guard]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Hook hoort bij de provider (zelfde patroon als useAuth/useTenant).
// eslint-disable-next-line react-refresh/only-export-components
export function useKassaSession(): KassaSessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useKassaSession buiten KassaSessionProvider');
  return v;
}
