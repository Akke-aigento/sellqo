// KASSA-UX-6 — "Mijn dienst": wat de aangemelde medewerker vandaag afrekende en aan fooi kreeg.
// Zelfde cijfers als de regel van die medewerker in het X-rapport (kassa_my_shift leest
// kassa_report_data voor de lopende bedrijfsdag). Enkel lezen: geen rapport, geen fiscaal event.
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';
// KASSA-MOBIEL-1: de kassa-client (eigen sessie van het toestel), niet de beheer-sessie.
import { kassaSupabase as supabase } from '@/kassa/app/kassaSupabase';
import type { ActionCtx } from '../horeca/actions';
import { formatEuro } from '../horeca/format';

interface MyShift { booking_date: string; from: string; to: string; count: number; total_cents: number; tips_cents: number }

export function MyShiftScreen({ ctx }: { ctx: ActionCtx }) {
  const { t, i18n } = useTranslation();
  const euro = (c: number) => formatEuro(c, i18n.language);
  const tenantId = ctx.runtime.device.tenantId;
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['kassa-my-shift', tenantId, ctx.staffId],
    queryFn: async () => {
      const { data: r, error: e } = await supabase.rpc('kassa_my_shift' as never, { p_tenant_id: tenantId, p_staff_id: ctx.staffId } as never);
      if (e) throw e;
      return r as unknown as MyShift;
    },
  });
  const since = data ? new Date(data.from).toLocaleString(i18n.language, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-3">
      <section className="rounded-lg border p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-bold">{ctx.staffName}</p>
            {data ? <p className="text-sm text-muted-foreground">{t('kassa.ux6.shiftSince', { at: since })}</p> : null}
          </div>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} aria-label={t('kassa.ux6.refresh')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border disabled:opacity-40">
            <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </button>
        </div>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t('kassa.common.loading')} /> : error || !data ? (
          <p role="alert" className="text-sm text-destructive">{t('kassa.ux6.shiftError')}</p>
        ) : (
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-muted p-3"><dt className="text-xs text-muted-foreground">{t('kassa.ux6.shiftCount')}</dt><dd className="text-lg font-bold tabular-nums sm:text-xl">{data.count}</dd></div>
            <div className="rounded-md bg-muted p-3"><dt className="text-xs text-muted-foreground">{t('kassa.ux6.shiftTotal')}</dt><dd className="text-lg font-bold tabular-nums sm:text-xl">{euro(data.total_cents)}</dd></div>
            <div className="rounded-md bg-muted p-3"><dt className="text-xs text-muted-foreground">{t('kassa.ux6.shiftTips')}</dt><dd className="text-lg font-bold tabular-nums sm:text-xl">{euro(data.tips_cents)}</dd></div>
          </dl>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t('kassa.ux6.shiftHint')}</p>
      </section>
    </div>
  );
}
