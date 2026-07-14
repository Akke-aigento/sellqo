import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { OdooSyncRow } from '@/hooks/useOdooSyncStatuses';

interface Props {
  row: OdooSyncRow | undefined;
}

export function OdooSyncBadge({ row }: Props) {
  if (!row) return null;

  if (row.sync_status === 'synced') {
    const peppolManual = row.peppol_status === 'manual';
    const cls = peppolManual
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    const label = peppolManual ? `Odoo #${row.odoo_move_id} · Peppol handmatig` : `Odoo #${row.odoo_move_id}`;
    const tip = peppolManual
      ? `Gepost in Odoo als move ${row.odoo_move_id}. Peppol-verzending kon niet automatisch: ${row.peppol_note ?? 'onbekend'}. Verstuur manueel in Odoo.`
      : `Gepost in Odoo als move ${row.odoo_move_id}${row.peppol_status === 'sent' ? ' · Peppol verzonden' : ''}.`;
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
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Odoo mislukt</Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{row.error_message ?? 'Onbekende fout'}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Odoo wachtrij</Badge>
  );
}