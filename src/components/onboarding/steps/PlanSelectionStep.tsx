// PRICE-2 — planstap van de onboarding: plannen en inhoud uit pricing_plans (zelfde regels
// als /pricing), gefilterd en aanbevolen per sector. Geen hardcoded limieten meer.
import { useEffect, useMemo, useRef } from 'react';
import { Check, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePricingPlans } from '@/hooks/usePricingPlans';
import { cn } from '@/lib/utils';
import { eur, planLines } from '@/lib/planLines';

type Sector = 'retail' | 'horeca' | 'events';
const SECTOR_PLANS: Record<Sector, { ids: string[]; recommended: string[] }> = {
  retail: { ids: ['free', 'starter', 'pro', 'enterprise'], recommended: ['starter'] },
  horeca: { ids: ['horeca', 'pro', 'free'], recommended: ['horeca', 'pro'] },
  events: { ids: ['events_flex', 'starter', 'pro'], recommended: ['events_flex', 'starter'] },
};

interface PlanSelectionStepProps {
  selectedPlanId: string;
  sector?: Sector;
  onSelectPlan: (planId: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function PlanSelectionStep({ selectedPlanId, sector = 'retail', onSelectPlan, onNext, onPrev }: PlanSelectionStepProps) {
  const { t, i18n } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`onboarding.plan.${x}`, o);
  const p = (x: string, o?: Record<string, unknown>) => t(`landing.pricing.${x}`, o);
  const { plans, isLoading } = usePricingPlans();
  const cfg = SECTOR_PLANS[sector] ?? SECTOR_PLANS.retail;
  const shown = useMemo(() => cfg.ids.map((id) => plans.find((pl) => pl.id === id)).filter((pl): pl is NonNullable<typeof pl> => !!pl), [cfg, plans]);
  const recommended = cfg.recommended.find((id) => shown.some((pl) => pl.id === id)) ?? null;

  // Eén keer het aanbevolen plan voorselecteren als de keuze nog op de standaard staat
  // of niet bij deze sector hoort.
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || !shown.length) return;
    preselected.current = true;
    const fits = shown.some((pl) => pl.id === selectedPlanId);
    if (recommended && (!fits || (selectedPlanId === 'free' && sector !== 'retail'))) onSelectPlan(recommended);
    else if (!fits) onSelectPlan(shown[0].id);
  }, [shown, recommended, selectedPlanId, sector, onSelectPlan]);

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold">{k('title')}</h2>
        <p className="text-muted-foreground">{k('subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-lg" />)}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2" role="radiogroup" aria-label={k('title')}>
          {shown.map((plan) => {
            const on = selectedPlanId === plan.id;
            const monthly = Number(plan.monthly_price);
            const fee = Number(plan.ticket_fee ?? 0);
            const { lines, note } = planLines(plan, t, i18n.language);
            return (
              <button key={plan.id} type="button" role="radio" aria-checked={on} onClick={() => onSelectPlan(plan.id)}
                className={cn('relative flex flex-col rounded-xl border-2 bg-card p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  on ? 'border-primary' : 'border-border hover:border-primary/50')}>
                {plan.id === recommended ? (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">{k('recommended')}</span>
                ) : null}
                <span className="flex items-center justify-between gap-2">
                  <span className="text-lg font-semibold">{plan.name}</span>
                  {on ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary"><Check className="h-4 w-4 text-primary-foreground" /></span> : null}
                </span>
                <span className="mt-2">
                  <span className="text-2xl font-bold">{monthly === 0 ? (fee > 0 ? eur(0, i18n.language) : p('free')) : eur(monthly, i18n.language)}</span>
                  {monthly > 0 || fee > 0 ? <span className="text-muted-foreground">{p('perMonth')}</span> : null}
                </span>
                {fee > 0 ? <span className="text-sm font-semibold">{p('per_ticket', { fee: eur(fee, i18n.language) })}</span> : null}
                <span className="mt-1 text-xs text-muted-foreground">{monthly > 0 ? k('trial_then', { price: eur(monthly, i18n.language) }) : k('no_trial')}</span>
                <ul className="mt-4 space-y-1.5">
                  {lines.slice(0, 6).map((l) => (
                    <li key={l} className="flex items-start gap-2 text-sm"><Check className={cn('mt-0.5 h-4 w-4 shrink-0', on ? 'text-primary' : 'text-muted-foreground')} />{l}</li>
                  ))}
                  {note ? <li className="flex items-start gap-2 text-sm text-muted-foreground"><Minus className="mt-0.5 h-4 w-4 shrink-0" />{note}</li> : null}
                </ul>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">{k('footer')}</p>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onPrev}>{k('prev')}</Button>
        <Button onClick={onNext} disabled={!selectedPlanId}>{k('next')}</Button>
      </div>
    </div>
  );
}
