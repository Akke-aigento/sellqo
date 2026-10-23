// TAFEL-1 — React-kant van de HorecaStore: één store per zaak en toestel, poll elke 2 s,
// meldingen bij weigeringen. "Live · 2 s" of "Offline · n wachtende acties" komt hieruit.
import { useEffect, useMemo, useReducer } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { HorecaStore } from './store';

const POLL_MS = 2000;
const stores = new Map<string, HorecaStore>();

export function getStore(tenantId: string, deviceId: string): HorecaStore {
  const key = `${tenantId}|${deviceId}`;
  let s = stores.get(key);
  if (!s) { s = new HorecaStore(tenantId, deviceId); stores.set(key, s); }
  return s;
}

export function useHoreca(tenantId: string, deviceId: string) {
  const { t } = useTranslation();
  const store = useMemo(() => getStore(tenantId, deviceId), [tenantId, deviceId]);
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => store.subscribe(rerender), [store]);

  useEffect(() => {
    let alive = true;
    void store.refresh();
    const tick = async () => {
      if (!alive) return;
      // Geen polling in een verborgen tabblad/app op de achtergrond: bespaart databanklast.
      if (typeof document === 'undefined' || document.visibilityState === 'visible') await store.poll();
      for (const r of store.takeRejections()) toast.error(t('kassa.checks.rejected', { error: r.error }));
    };
    const timer = setInterval(() => { void tick(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void store.refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [store, t]);

  return store;
}
