// SOCIAL-WEEKS-1 — één week in de Social planning, toeklapbaar.
// Standaard open: deze week en elke week waar iets op jou wacht (goedkeuren, mislukt,
// opnieuw maken). Voorbije en latere weken zonder actie staan dicht, met een samenvatting
// per status, zodat de pagina overzichtelijk blijft.

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, format } from 'date-fns';
import { CheckCheck, ChevronDown, Loader2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GatedButton } from '@/components/permissions/GatedButton';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { cn } from '@/lib/utils';
import type { PlannerStatus, PlannerWeek } from '@/hooks/useSocialPlanner';
import { weekKind } from '@/lib/social/weeks';

/** Groepen voor de samenvatting, in volgorde van dringendheid. Het label is dat van de eerste status. */
const SUMMARY: { statuses: PlannerStatus[]; className: string }[] = [
  { statuses: ['failed'], className: 'bg-destructive/10 text-destructive' },
  { statuses: ['pending_approval', 'draft'], className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  { statuses: ['regenerate_requested'], className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' },
  { statuses: ['manual'], className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  { statuses: ['scheduled', 'approved', 'publishing'], className: 'bg-muted text-foreground' },
  { statuses: ['posted'], className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
];

interface Props {
  week: PlannerWeek;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onApproveWeek: () => void;
  children: ReactNode;
}

export function SocialPlannerWeek({ week, open, onOpenChange, busy, onApproveWeek, children }: Props) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const start = new Date(week.weekStart);
  const kind = weekKind(week.weekStart);

  const summary = SUMMARY
    .map((g) => ({ ...g, count: week.posts.filter((p) => g.statuses.includes(p.status)).length }))
    .filter((g) => g.count > 0);

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} asChild>
      <section className="space-y-3">
        <div className={cn('py-2 flex flex-col gap-2 border-b sm:flex-row sm:items-center sm:justify-between', kind === 'past' && 'opacity-80')}>
          <CollapsibleTrigger className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', !open && '-rotate-90')} />
            <h2 className="text-base font-semibold">
              {t('admin.socialPlanner.week', {
                from: format(start, 'd MMM', { locale }),
                to: format(addDays(start, 6), 'd MMM', { locale }),
              })}
            </h2>
            {kind !== 'later' && (
              <span className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                kind === 'this' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}>
                {t(`admin.socialPlanner.weekGroup.${kind === 'this' ? 'thisWeek' : kind === 'next' ? 'nextWeek' : 'past'}`)}
              </span>
            )}
            {summary.map((g) => (
              <span key={g.statuses[0]} className={cn('rounded-full px-2 py-0.5 text-xs', g.className)}>
                {t(`admin.socialPlanner.status.${g.statuses[0]}`)} {g.count}
              </span>
            ))}
          </CollapsibleTrigger>
          {week.pendingIds.length > 0 && (
            <GatedButton action="write" resource="marketing" size="sm" className="self-start sm:self-auto" onClick={onApproveWeek} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCheck className="h-4 w-4 mr-1" />}
              {t('admin.socialPlanner.approveWeek', { count: week.pendingIds.length })}
            </GatedButton>
          )}
        </div>
        <CollapsibleContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
