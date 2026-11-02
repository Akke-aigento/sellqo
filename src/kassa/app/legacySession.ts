// KASSA-MOBIEL-1 — eenmalige verhuis van een bestaande toestelsessie naar de kassa-storageKey.
//
// Tot KASSA-MOBIEL-1 deelden kassa en beheer één sessie (standaard-storageKey sb-<ref>-auth-token). Een toestel
// dat al gekoppeld was, heeft zijn toestelsessie dus daar staan. Bij het opstarten van de kassa:
//   - staat er in de standaardsleutel een toestelaccount (user.app_metadata.kind = 'kassa'), en
//   - is de kassa-sleutel nog leeg,
// dan verhuist die sessie één keer naar de kassa-sleutel en verdwijnt ze uit de standaardsleutel (zodat beheer
// daar niet langer als toestel aangemeld staat). Een eigenaar-sessie wordt nooit verhuisd.
//
// Kopiëren en wissen gebeurt onder het navigator-lock van de beheer-client ("lock:<sleutel>", hetzelfde lock dat
// supabase-js zelf neemt). Zo kan de beheer-client niet halverwege een token vernieuwen: anders zou de kopie een
// verbruikt refresh-token hebben en zou Supabase (hergebruik-detectie) de hele toestelsessie intrekken.
// migrateLegacyDeviceSession is puur (Storage-interface), zodat het testbaar is; moveLegacySessionOnce doet het echt.
import { supabase } from '@/integrations/supabase/client';
import { defaultAuthStorageKey, KASSA_AUTH_STORAGE_KEY } from '@/kassa/app/kassaSupabase';

/** Service-worker-scope van de kassa voor web push (eigen abonnement naast dat van beheer). */
export const KASSA_PUSH_SCOPE = '/kassa/';

export type LegacyMoveResult = 'moved' | 'kassa-present' | 'none' | 'not-device';

export interface MinimalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LockRunner = <T>(name: string, fn: () => T) => Promise<T>;

/** navigator.locks als die er is (alle huidige browsers, WKWebView vanaf iOS 15.4), anders meteen uitvoeren. */
export const navigatorLock: LockRunner = async (name, fn) => {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (!locks?.request) return fn();
  return locks.request(name, { mode: 'exclusive' }, async () => fn()) as Promise<Awaited<ReturnType<typeof fn>>>;
};

/** Is deze opgeslagen sessie (JSON van supabase-js) die van een kassatoestel? */
export function isDeviceSessionJson(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const s = JSON.parse(raw) as { user?: { app_metadata?: { kind?: unknown } } } | null;
    return s?.user?.app_metadata?.kind === 'kassa';
  } catch {
    return false;
  }
}

export async function migrateLegacyDeviceSession(opts: {
  storage: MinimalStorage;
  defaultKey: string;
  kassaKey: string;
  lock?: LockRunner;
}): Promise<LegacyMoveResult> {
  const { storage, defaultKey, kassaKey } = opts;
  const lock = opts.lock ?? navigatorLock;
  const read = (k: string) => { try { return storage.getItem(k); } catch { return null; } };
  // Snelle uitweg zonder lock: in bijna elke start valt hier al de beslissing.
  if (read(kassaKey)) return 'kassa-present';
  const first = read(defaultKey);
  if (!first) return 'none';
  if (!isDeviceSessionJson(first)) return 'not-device';
  return lock(`lock:${defaultKey}`, () => {
    // Opnieuw lezen onder het lock: de beheer-client kan de sessie intussen vernieuwd (of gewist) hebben.
    if (read(kassaKey)) return 'kassa-present' as const;
    const raw = read(defaultKey);
    if (!raw) return 'none' as const;
    if (!isDeviceSessionJson(raw)) return 'not-device' as const;
    try { storage.setItem(kassaKey, raw); } catch { return 'none' as const; }
    // Nooit dezelfde sessie op twee plekken laten staan (twee clients die hetzelfde token vernieuwen).
    try { storage.removeItem(defaultKey); } catch { try { storage.removeItem(kassaKey); } catch { /* niets meer te doen */ } return 'none' as const; }
    return 'moved' as const;
  });
}

/** Eénmalig bij het opstarten: een toestelsessie uit de beheer-sleutel naar de kassa-sleutel. Daarna ziet de
 *  beheer-client geen sessie meer; signOut({scope:'local'}) zonder sessie doet geen serveraanroep, ruimt enkel
 *  de beheer-staat op (AuthProvider krijgt SIGNED_OUT). Exported voor de tests. */
export async function moveLegacySessionOnce(): Promise<boolean> {
  const r = await migrateLegacyDeviceSession({
    storage: window.localStorage,
    defaultKey: defaultAuthStorageKey(),
    kassaKey: KASSA_AUTH_STORAGE_KEY,
  }).catch(() => 'none' as const);
  if (r !== 'moved') return false;
  try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* niets in de opslag: niets te doen */ }
  return true;
}
