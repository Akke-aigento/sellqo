// TAFEL-2/LIVE-1 — wat het toestel op de achtergrond doet, ook als de kassa vergrendeld is:
// wachtende betalingen doorsturen (na een handtekening zonder verbinding) en de hartslag.
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { KassaRuntime } from './runtime';
import { getStore } from './horeca/useHoreca';
import { readPendingPays, retryPendingPays } from './horeca/payActions';
import { HEARTBEAT_MS, sendHeartbeat } from './heartbeat';

export function useKassaBackground(runtime: KassaRuntime | null) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!runtime) return;
    const store = getStore(runtime.device.tenantId, runtime.device.deviceUuid);
    store.beforeFlush = () => runtime.flushOutbox();
    let alive = true;
    const retry = async () => {
      if (!readPendingPays(runtime.device.tenantId).length) return;
      const r = await retryPendingPays({ runtime });
      if (!alive) return;
      if (r.done) { toast.success(t('kassa.pay.pendingDone', { n: r.done })); void store.refresh(); }
      for (const x of r.rejected) toast.error(t('kassa.pay.pendingRejected', { error: x.error }), { duration: 30_000 });
    };
    void retry();
    void sendHeartbeat(runtime, store);
    const r = setInterval(() => { void retry(); }, 10_000);
    const h = setInterval(() => { void sendHeartbeat(runtime, store); }, HEARTBEAT_MS);
    return () => { alive = false; clearInterval(r); clearInterval(h); };
  }, [runtime, t]);
}
