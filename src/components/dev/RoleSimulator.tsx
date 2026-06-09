import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AppRole } from "@/hooks/useAuth";

/**
 * H4e — Dev-only Rol-simulator.
 *
 * Overschrijft alleen het UI-resultaat van `useCan`. RLS, edge-functions
 * en business-logica blijven onder de echte rol draaien (typisch
 * platform_admin bypass). Gebruik puur als visuele check.
 */

const STORAGE_KEY = "h4e:simulated-role";

type SimulatedRoleState = {
  role: AppRole | null;
  setRole: (r: AppRole | null) => void;
};

export const SimulatedRoleContext = createContext<SimulatedRoleState>({
  role: null,
  setRole: () => {},
});

export function SimulatedRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<AppRole | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return (raw as AppRole | null) || null;
  });

  const setRole = (r: AppRole | null) => {
    setRoleState(r);
    if (typeof window === "undefined") return;
    if (r) sessionStorage.setItem(STORAGE_KEY, r);
    else sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <SimulatedRoleContext.Provider value={{ role, setRole }}>
      {children}
    </SimulatedRoleContext.Provider>
  );
}

export function useSimulatedRole() {
  return useContext(SimulatedRoleContext);
}

const ALL_ROLES: AppRole[] = [
  "platform_admin",
  "tenant_admin",
  "accountant",
  "staff",
  "warehouse",
  "viewer",
  "marketing",
];

export function RoleSimulator() {
  // Only render in dev builds.
  if (!import.meta.env.DEV) return null;
  const { role, setRole } = useSimulatedRole();
  const [open, setOpen] = useState(false);

  // Optional keyboard shortcut: Ctrl+Shift+R toggles the widget.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {role && (
        <div className="fixed top-0 inset-x-0 z-[9999] bg-amber-500/90 text-amber-950 text-xs font-semibold px-3 py-1 flex items-center justify-center gap-3 shadow">
          🧪 Rol-simulator actief: <span className="font-mono">{role}</span>
          <button
            onClick={() => setRole(null)}
            className="underline underline-offset-2 hover:opacity-80"
          >
            Reset
          </button>
        </div>
      )}
      <div className="fixed bottom-3 right-3 z-[9999]">
        {open ? (
          <div className="bg-background border border-border rounded-lg shadow-lg p-3 w-64 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">🧪 Rol-simulator (DEV)</span>
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
            <select
              value={role ?? ""}
              onChange={(e) => setRole((e.target.value || null) as AppRole | null)}
              className="w-full text-xs border border-border rounded px-2 py-1 bg-background"
            >
              <option value="">— gebruik echte rol —</option>
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Overschrijft alleen UI gating (<code>useCan</code>). RLS bypasst nog
              altijd via je echte rol — geen substituut voor echte rol-tests.
            </p>
            <button
              onClick={() => setRole(null)}
              className="w-full text-xs border border-border rounded py-1 hover:bg-muted"
            >
              Reset naar echte rol
            </button>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="bg-background border border-border rounded-full shadow-md px-3 py-1 text-xs font-medium hover:bg-muted"
            title="Rol-simulator (Ctrl+Shift+R)"
          >
            🧪 {role ?? "rol"}
          </button>
        )}
      </div>
    </>
  );
}