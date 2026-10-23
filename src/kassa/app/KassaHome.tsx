// KASSA-0 — startpagina van het kassa-skelet: toont de versie en laat de ingebouwde
// FDM-simulator één testverkoop ondertekenen (geen echte zwarte doos, niets in de database).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildSale } from '../fiscal/builders';
import { milli4 } from '../fiscal/money';
import { FdmSimulator } from '../fiscal/simulator/fdmSimulator';
import { FiscalSender, MemoryPendingStore, SimulatorGateway } from '../fiscal/gateway';
import { TEST_POS, testMeta } from '../fiscal/testSetup';
import { KASSA_SW_VERSION } from '../version';

export function KassaHome() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runTest = async () => {
    setBusy(true);
    try {
      const sender = new FiscalSender(new SimulatorGateway(new FdmSimulator()), new MemoryPendingStore());
      const sale = buildSale({ ...TEST_POS, posSwVersion: KASSA_SW_VERSION }, testMeta(), {
        lines: [{ kind: 'single', main: { product: { productId: '10006', productName: 'Dry Martini', departmentId: '10', departmentName: 'Aperitifs' }, quantity: milli4(2), unitPrice: milli4(12), vats: [{ label: 'A' }] } }],
        payments: [{ id: '1', name: 'CONTANT', type: 'CASH', inputMethod: 'MANUAL', amount: 2400, drawer: { id: '1', name: 'Drawer 1' } }],
      });
      const out = await sender.sign('signSale', sale);
      setStatus(out.kind === 'signed'
        ? t('kassa.skeleton.signed', { label: out.result.fdmRef.eventLabel, counter: out.result.fdmRef.eventCounter })
        : t('kassa.skeleton.notSigned', { reason: out.kind }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
      style={{ paddingTop: 'max(1.5rem, var(--safe-top))', paddingBottom: 'max(1.5rem, var(--safe-bottom))' }}>
      <h1 className="text-2xl font-bold">{t('kassa.skeleton.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('kassa.skeleton.version', { version: KASSA_SW_VERSION })}</p>
      <button type="button" onClick={runTest} disabled={busy}
        className="h-11 rounded-md bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">
        {t('kassa.skeleton.testButton')}
      </button>
      {status && <p role="status" className="text-sm">{status}</p>}
    </main>
  );
}
