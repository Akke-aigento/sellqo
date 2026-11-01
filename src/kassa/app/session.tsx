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
  /** KASSA-RECHTEN-1 (review 1): sessietoken van kassa_staff_login; enkel in het geheugen, nooit in opslag. */
  staffToken: string | null;
  signIn: (staff: KassaStaff, employeeId: string | null, staffToken?: string | null) => void;
  lock: () => void;
  /**
   * KASSA-UX-3: scherm aan de muur (Keuken, Bar) — niet vergrendelen bij inactiviteit. Tikken in die
   * modus telt niet als activiteit: wie na de wachttijd iets registreert of naar Zaal gaat, geeft eerst zijn PIN.
   */
  setIdlePaused: (paused: boolean) => void;
  /** True = de medewerker mag verder; false = te lang inactief, de kassa is nu vergrendeld (PIN). */
  guard: () => boolean;
  /**
   * KASSA-UX-6: wie er stond toen de kassa door inactiviteit vergrendelde (het PIN-scherm kiest die
   * naam alvast). Na "Wissel" (lock) is dit null: dan kiest de volgende zelf.
   */
  resumeStaff: KassaStaff | null;
  /** KASSA-UX-6: wachttijd tot vergrendelen, per zaak instelbaar (ms; 0 = nooit). */
  setIdleMs: (ms: number) => void;
}

const Ctx = createContext<KassaSessionValue | null>(null);

export const DEFAULT_IDLE_MS = 2 * 60_000;

export function KassaSessionProvider({ children, idleMs: idleProp = DEFAULT_IDLE_MS, onEnd }: {
  children: ReactNode; idleMs?: number;
  /** Review 1: bij elke vergrendeling (Wissel of inactiviteit) het sessietoken intrekken op de server. */
  onEnd?: (staffToken: string) => void;
}) {
  const tokenRef = useRef<string | null>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const endToken = useCallback(() => {
    const tk = tokenRef.current;
    tokenRef.current = null;
    if (tk) { try { onEndRef.current?.(tk); } catch { /* best effort: offline verloopt het token einde bedrijfsdag */ } }
  }, []);
  const [staff, setStaff] = useState<KassaStaff | null>(null);
  const [idleMs, setIdleMsState] = useState(idleProp);
  useEffect(() => { setIdleMsState(idleProp); }, [idleProp]);
  const setIdleMs = useCallback((ms: number) => { setIdleMsState(Number.isFinite(ms) && ms >= 0 ? ms : DEFAULT_IDLE_MS); }, []);
  const [resumeStaff, setResumeStaff] = useState<KassaStaff | null>(null);
  const staffRef = useRef<KassaStaff | null>(null);
  const employeeIdRef = useRef<string | null>(null);
  const [, force] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const lastActive = useRef(Date.now());

  /** "Wissel": de volgende medewerker kiest zelf zijn naam. */
  const lock = useCallback(() => {
    employeeIdRef.current = null;
    endToken();
    staffRef.current = null;
    setResumeStaff(null);
    setStaff(null);
  }, [endToken]);
  /** Inactiviteit: dezelfde medewerker staat voorgekozen op het PIN-scherm. */
  const idleLock = useCallback(() => {
    employeeIdRef.current = null;
    endToken();
    setResumeStaff(staffRef.current);
    staffRef.current = null;
    setStaff(null);
  }, [endToken]);

  const signIn = useCallback((s: KassaStaff, employeeId: string | null, staffToken: string | null = null) => {
    employeeIdRef.current = employeeId;
    tokenRef.current = staffToken;
    lastActive.current = Date.now();
    staffRef.current = s;
    setResumeStaff(null);
    setStaff(s);
    force((x) => x + 1);
  }, []);

  // Inactiviteit = vergrendelen. Elke tik, toets of scroll houdt de sessie open.
  useEffect(() => {
    if (!staff || idleMs <= 0) return;
    if (paused) return; // Keuken/Bar: geen tijdslot; guard() bewaakt het verlaten.
    lastActive.current = Date.now();
    let timer = window.setTimeout(idleLock, idleMs);
    const bump = () => { lastActive.current = Date.now(); window.clearTimeout(timer); timer = window.setTimeout(idleLock, idleMs); };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, bump, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, bump);
    };
  }, [staff, idleMs, idleLock, paused]);

  const setIdlePaused = useCallback((p: boolean) => { pausedRef.current = p; setPaused(p); }, []);
  const guard = useCallback(() => {
    if (idleMs > 0 && Date.now() - lastActive.current >= idleMs) { idleLock(); return false; }
    if (!pausedRef.current) lastActive.current = Date.now();
    return true;
  }, [idleMs, idleLock]);

  const value = useMemo<KassaSessionValue>(() => ({ staff, employeeId: employeeIdRef.current, staffToken: tokenRef.current, signIn, lock, setIdlePaused, guard, resumeStaff, setIdleMs }),
    [staff, signIn, lock, setIdlePaused, guard, resumeStaff, setIdleMs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Hook hoort bij de provider (zelfde patroon als useAuth/useTenant).
// eslint-disable-next-line react-refresh/only-export-components
export function useKassaSession(): KassaSessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useKassaSession buiten KassaSessionProvider');
  return v;
}
