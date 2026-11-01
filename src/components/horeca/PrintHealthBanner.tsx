// KEUKEN-VEILIG-1 — waarschuwing in de kassa en op het keukenscherm als een bonprinter niet afdrukt.
// "Gezien" verbergt de melding tot er een nieuw probleem is (per toestel bewaard).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';
import { hasPrintProblem, usePrintHealth } from './printHealth';

const ACK_KEY = 'sq_print_health_ack';
const readAck = () => { try { return Number(localStorage.getItem(ACK_KEY)) || 0; } catch { return 0; } };

export function PrintHealthBanner({ tenantId }: { tenantId: string | null | undefined }) {
  const { t } = useTranslation();
  const { data } = usePrintHealth(tenantId);
  const [ack, setAck] = useState(readAck);
  if (!data || !hasPrintProblem(data, ack)) return null;
  const parts = [
    data.failed ? t('admin.kitchen.print_health_failed', { count: data.failed }) : null,
    data.stuck ? t('admin.kitchen.print_health_stuck', { count: data.stuck }) : null,
    data.offline.length ? t('admin.kitchen.print_health_offline', { names: data.offline.join(', ') }) : null,
  ].filter(Boolean);
  const seen = () => {
    const v = Math.max(data.latestMs, Date.now());
    setAck(v);
    try { localStorage.setItem(ACK_KEY, String(v)); } catch { /* privémodus */ }
  };
  return (
    <div role="alert" className="flex items-center gap-2 border-b border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100">
      <Printer className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1"><span className="font-bold">{t('admin.kitchen.print_health_title')}</span> {parts.join(' · ')}. {t('admin.kitchen.print_health_hint')}</p>
      <button type="button" onClick={seen} className="h-11 shrink-0 rounded-md border border-current px-3 text-sm font-semibold">{t('admin.kitchen.print_health_seen')}</button>
    </div>
  );
}
