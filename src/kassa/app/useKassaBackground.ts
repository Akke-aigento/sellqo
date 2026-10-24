// TAFEL-2/LIVE-1/TAFEL-3 — wat het toestel op de achtergrond doet, ook als de kassa vergrendeld is:
// wachtende betalingen en kas-/rapporthandelingen doorsturen (na een handtekening zonder
// verbinding), de hartslag, en ontbrekende Z-rapporten aanvullen (RPT-03).
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { KassaRuntime } from './runtime';
import { getStore } from './horeca/useHoreca';
import { readPendingPays, retryPendingPays } from './horeca/payActions';
import { HEARTBEAT_MS, sendHeartbeat } from './heartbeat';
import { readPendingOps, retryFiscalOps } from './fiscalOps';
import { autoZ } from './reportActions';

const AUTO_Z_MS = 15 * 60_000;

export function useKassaBackground(runtime: KassaRuntime | null) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!runtime) return;
    const store = getStore(runtime.device.tenantId, runtime.device.deviceUuid);
    store.beforeFlush = () => runtime.flushOutbox();
    let alive = true;
    const retry = async () => {
      if (readPendingPays(runtime.device.tenantId).length) {
        const r = await retryPendingPays({ runtime });
        if (!alive) return;
        if (r.done) { toast.success(t('kassa.pay.pendingDone', { n: r.done })); void store.refresh(); }
        for (const x of r.rejected) toast.error(t('kassa.pay.pendingRejected', { error: x.error }), { duration: 30_000 });
      }
      if (readPendingOps(runtime.device.tenantId).length) {
        const r = await retryFiscalOps(runtime);
        if (!alive) return;
        if (r.done) toast.success(t('kassa.cash.pendingDone', { n: r.done }));
        for (const x of r.rejected) toast.error(t('kassa.cash.pendingRejected', { error: x.error }), { duration: 30_000 });
      }
    };
    const zed = async () => {
      try {
        const r = await autoZ(runtime);
        if (alive && r.made) toast.success(t('kassa.reports.autoZDone', { n: r.made }));
      } catch { /* offline: volgende keer */ }
    };
    void retry();
    void sendHeartbeat(runtime, store);
    void zed();
    const r = setInterval(() => { void retry(); }, 10_000);
    const h = setInterval(() => { void sendHeartbeat(runtime, store); }, HEARTBEAT_MS);
    const z = setInterval(() => { void zed(); }, AUTO_Z_MS);
    return () => { alive = false; clearInterval(r); clearInterval(h); clearInterval(z); };
  }, [runtime, t]);
}
