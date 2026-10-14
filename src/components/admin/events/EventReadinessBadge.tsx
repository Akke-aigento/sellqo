// EVENT-FLOW-2 — badge "Klaar voor verkoop" / "Niet verkoopbaar: <reden>" per eventdatum.
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { Readiness } from '@/lib/eventReadiness';

export function EventReadinessBadge({ readiness, loading = false, className }: {
  readiness: Readiness; loading?: boolean; className?: string;
}) {
  const { t } = useTranslation();
  if (loading || readiness.state === null) return null;
  const k = (x: string) => t(`events.readiness.${x}`);

  if (readiness.state === 'ready') {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', className)}>
        <CheckCircle2 className="h-3.5 w-3.5" />{k('ready')}
      </span>
    );
  }
  if (readiness.state === 'warning') {
    return (
      <span title={readiness.warnings.map((w) => k(`warn_${w}_hint`)).join(' ')}
        className={cn('inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-300', className)}>
        <AlertTriangle className="h-3.5 w-3.5" />{k('ready_but')} {readiness.warnings.map((w) => k(`warn_${w}`)).join(', ')}
      </span>
    );
  }
  return (
    <span title={readiness.blocks.map((b) => k(`block_${b}_hint`)).join(' ')}
      className={cn('inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300', className)}>
      <XCircle className="h-3.5 w-3.5" />{k('blocked')}: {readiness.blocks.map((b) => k(`block_${b}`)).join(', ')}
    </span>
  );
}
