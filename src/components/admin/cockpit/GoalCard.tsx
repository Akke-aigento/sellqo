import { useState } from 'react';
import { format } from 'date-fns';
import { Flame, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useTenant } from '@/hooks/useTenant';
import { useCockpitGoal } from '@/hooks/useCockpitTracks';
import type { CockpitRevenueData } from '@/hooks/useCockpitRevenue';
import { goalProgress } from '@/lib/cockpitInsights';
import { formatCurrency } from '@/lib/utils';
import { CockpitNoAccess } from './CockpitNoAccess';

interface Props {
  canRead: boolean;
  canEdit: boolean;
  data: CockpitRevenueData | undefined;
  isLoading: boolean;
}

const R = 52;
const C = 2 * Math.PI * R;

/** DASH-2b — maanddoel van de winkel als ring, met reeksen en records eronder. */
export function GoalCard({ canRead, canEdit, data, isLoading }: Props) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const { currentTenant } = useTenant();
  const currency = currentTenant?.currency || 'EUR';
  const { goal, isLoading: goalLoading, save } = useCockpitGoal();
  const now = data?.periods.now ?? new Date();
  const month = format(now, 'LLLL', { locale });

  let body: React.ReactNode;
  if (!canRead) {
    body = <CockpitNoAccess />;
  } else if (isLoading || goalLoading || !data) {
    body = (
      <div className="flex items-center gap-5">
        <Skeleton className="h-28 w-28 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    );
  } else if (!goal) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          {t('admin.cockpit.goal.empty', { amount: formatCurrency(data.monthTotal, currency), month })}
        </p>
        {canEdit && <GoalEditor goal={null} onSave={(v) => save.mutateAsync(v)} trigger={t('admin.cockpit.goal.set')} />}
      </div>
    );
  } else {
    const g = goalProgress(goal, data.monthTotal, now);
    const dash = Math.min(1, g.pct / 100) * C;
    body = (
      <div className="flex items-center gap-5">
        <svg width="112" height="112" viewBox="0 0 128 128" className="shrink-0" role="img" aria-label={t('admin.cockpit.goal.ring_label', { pct: g.pct })}>
          <circle cx="64" cy="64" r={R} fill="none" strokeWidth="14" className="stroke-muted" />
          <circle
            cx="64"
            cy="64"
            r={R}
            fill="none"
            strokeWidth="14"
            strokeLinecap="round"
            className="stroke-[#FF6B33] transition-[stroke-dasharray] duration-700"
            strokeDasharray={`${dash} ${C}`}
            transform="rotate(-90 64 64)"
          />
          <text x="64" y="62" textAnchor="middle" className="fill-foreground text-[28px] font-extrabold">
            {g.pct}%
          </text>
          <text x="64" y="82" textAnchor="middle" className="fill-muted-foreground text-[12px]">
            {t('admin.cockpit.goal.of', { amount: formatCurrency(goal, currency) })}
          </text>
        </svg>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-2xl font-extrabold tabular-nums">{formatCurrency(data.monthTotal, currency)}</span>
          <span className="text-sm leading-snug text-muted-foreground">
            {g.remaining > 0
              ? t('admin.cockpit.goal.remaining', {
                  count: g.daysLeft,
                  amount: formatCurrency(g.remaining, currency),
                  perDay: formatCurrency(g.perDay, currency),
                })
              : t('admin.cockpit.goal.reached')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Card className="flex flex-col rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base first-letter:uppercase">{t('admin.cockpit.goal.title', { month })}</CardTitle>
        {canRead && canEdit && goal && <GoalEditor goal={goal} onSave={(v) => save.mutateAsync(v)} trigger={t('admin.cockpit.goal.change')} subtle />}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {body}
        {canRead && data && <RecordsList data={data} className="border-t pt-4" />}
      </CardContent>
    </Card>
  );
}

function GoalEditor({
  goal,
  onSave,
  trigger,
  subtle,
}: {
  goal: number | null;
  onSave: (v: number | null) => Promise<unknown>;
  trigger: string;
  subtle?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(goal ? String(goal) : '');
  const [busy, setBusy] = useState(false);

  const submit = async (next: number | null) => {
    setBusy(true);
    try {
      await onSave(next);
      toast.success(t('admin.cockpit.goal.saved'));
      setOpen(false);
    } catch {
      toast.error(t('admin.cockpit.goal.save_failed'));
    } finally {
      setBusy(false);
    }
  };

  const parsed = Number(value.replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(goal ? String(goal) : ''); }}>
      <PopoverTrigger asChild>
        <Button variant={subtle ? 'ghost' : 'default'} size="sm" className={subtle ? 'h-11 text-muted-foreground' : 'h-11'}>
          {trigger}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) void submit(Math.round(parsed * 100) / 100);
          }}
        >
          <Label htmlFor="cockpit-goal">{t('admin.cockpit.goal.input_label')}</Label>
          <Input
            id="cockpit-goal"
            inputMode="decimal"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="10000"
          />
          <p className="text-xs text-muted-foreground">{t('admin.cockpit.goal.input_help')}</p>
          <div className="flex justify-between gap-2">
            {goal ? (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void submit(null)}>
                {t('admin.cockpit.goal.remove')}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" disabled={!valid || busy}>
              {t('admin.cockpit.goal.save')}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Reeksen en records, gedeeld door het maanddoel (webshop) en de horeca-records. */
export function RecordsList({ data, className }: { data: CockpitRevenueData; className?: string }) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const { currentTenant } = useTenant();
  const currency = currentTenant?.currency || 'EUR';
  const scope = data.fullHistory ? t('admin.cockpit.records.scope_ever') : t('admin.cockpit.records.scope_year');
  const weekdayOf = (d: Date) => format(d, 'EEEE', { locale });

  const rows: { key: string; icon: 'flame' | 'trophy'; title: string; sub: string }[] = [];
  if (data.streak >= 3) {
    rows.push({ key: 'streak', icon: 'flame', title: t('admin.cockpit.records.streak', { count: data.streak }), sub: t('admin.cockpit.records.streak_sub') });
  }
  const recent = data.records.recentWeekdayRecord;
  if (recent) {
    rows.push({
      key: 'recent',
      icon: 'trophy',
      title: t('admin.cockpit.records.best_weekday', { weekday: weekdayOf(recent.date), scope }),
      sub: t('admin.cockpit.records.amount_on', { amount: formatCurrency(recent.revenue, currency), date: format(recent.date, 'd MMMM', { locale }) }),
    });
  }
  const best = data.records.bestSameWeekday;
  if (best && data.records.toBeatSameWeekday !== null) {
    const weekday = weekdayOf(data.periods.now);
    rows.push(
      data.records.toBeatSameWeekday === 0 && data.todayRevenue > 0
        ? { key: 'today', icon: 'trophy', title: t('admin.cockpit.records.today_best', { weekday, scope }), sub: formatCurrency(data.todayRevenue, currency) }
        : {
            key: 'today',
            icon: 'trophy',
            title: t('admin.cockpit.records.weekday_record', { weekday, amount: formatCurrency(best.revenue, currency) }),
            sub: t('admin.cockpit.records.to_beat', { amount: formatCurrency(data.records.toBeatSameWeekday, currency) }),
          },
    );
  }
  if (!rows.length) return null;

  return (
    <ul className={className ? `flex flex-col gap-3 ${className}` : 'flex flex-col gap-3'}>
      {rows.slice(0, 3).map((r) => (
        <li key={r.key} className="flex items-center gap-3">
          <span
            className={
              r.icon === 'flame'
                ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-[#1D3A5C] dark:bg-sky-950 dark:text-sky-200'
            }
            aria-hidden="true"
          >
            {r.icon === 'flame' ? <Flame className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-bold first-letter:uppercase">{r.title}</span>
            <span className="text-xs text-muted-foreground">{r.sub}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
