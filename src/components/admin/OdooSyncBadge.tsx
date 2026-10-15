import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { OdooSyncRow } from '@/hooks/useOdooSyncStatuses';

interface Props {
  row: OdooSyncRow | undefined;
}

export function OdooSyncBadge({ row }: Props) {
  const { t } = useTranslation();
  if (!row) return null;

  if (row.sync_status === 'synced') {
    const peppolManual = row.peppol_status === 'manual';
    const cls = peppolManual
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    const label = peppolManual
      ? t('admin.odooSync.synced_peppol_manual', { id: row.odoo_move_id })
      : t('admin.odooSync.synced', { id: row.odoo_move_id });
    const tip = peppolManual
      ? t('admin.odooSync.synced_peppol_manual_tip', {
          id: row.odoo_move_id,
          note: row.peppol_note ?? t('admin.odooSync.unknown'),
        })
      : row.peppol_status === 'sent'
        ? t('admin.odooSync.synced_peppol_sent_tip', { id: row.odoo_move_id })
        : t('admin.odooSync.synced_tip', { id: row.odoo_move_id });
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cls}>{label}</Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{tip}</TooltipContent>
      </Tooltip>
    );
  }

  if (row.sync_status === 'failed') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{t('admin.odooSync.failed')}</Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{row.error_message ?? t('admin.odooSync.unknown_error')}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">{t('admin.odooSync.pending')}</Badge>
  );
}
