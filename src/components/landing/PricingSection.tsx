// PRICE-2 / PLANS-2 — prijzen per spoor, rechtstreeks uit pricing_plans (tab = pricing_plans.track)
// en platform_addons (één bron: dezelfde tabellen waar de facturatie mee rekent). Wat een plan
// bevat, volgt uit zijn limieten en feature-vlaggen; er staat geen enkel bedrag of aantal
// hardcoded in deze component, behalve het opstartpakket (Studio Akke, zie priceVars.ts).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { usePricingPlans } from '@/hooks/usePricingPlans';
import { useAuth } from '@/hooks/useAuth';
import type { PricingPlan } from '@/types/billing';
import { eur, planLines } from '@/lib/planLines';
import { SETUP_PRICE } from '@/lib/priceVars';
import { usePlatformAddons } from '@/hooks/usePlatformAddons';

export type PricingTab = 'retail' | 'horeca' | 'events';
// TRACKS-1 / PLANS-2 — tab = spoor; welke plannen erin staan, volgt uit pricing_plans.track.
const TAB_TRACK: Record<PricingTab, 'webshop' | 'horeca' | 'events'> = { retail: 'webshop', horeca: 'horeca', events: 'events' };
const planTrack = (p: PricingPlan) => p.track ?? 'webshop';
function PlanCard({ plan, yearly, featured }: { plan: PricingPlan; yearly: boolean; featured: boolean }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const k = (x: string, o?: Record<string, unknown>) => t(`landing.pricing.${x}`, o);
  const monthly = Number(plan.monthly_price);
  const yearlyPrice = Number(plan.yearly_price);
  const ticketFee = Number(plan.ticket_fee ?? 0);
  const minTerm = Number((plan as { min_term_months?: number }).min_term_months ?? 0);
  const isEnterprise = plan.id === 'enterprise';
  const showYearly = yearly && yearlyPrice > 0;
  const { lines, note } = planLines(plan, t, i18n.language);
  const to = isEnterprise ? '/contact' : user ? `/admin/billing?plan=${plan.id}&interval=${showYearly ? 'yearly' : 'monthly'}` : '/auth?mode=register';

  return (
    <div className={cn('relative flex flex-col rounded-2xl border bg-card p-6 md:p-7', featured ? 'border-2 border-accent shadow-lg' : 'border-border')}>
      {featured ? (
        <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground">{k(`badge_${plan.id}`, { defaultValue: k('most_chosen') })}</span>
      ) : null}
      <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
      <p className="mt-1 min-h-[2.5rem] text-sm text-muted-foreground">{k(`desc_${plan.id}`)}</p>
      <div className="mt-5">
        {isEnterprise ? (
          <p className="text-3xl font-bold text-foreground"><span className="mr-1.5 text-base font-medium text-muted-foreground">{k('from_short')}</span>{eur(monthly, i18n.language)}<span className="text-base font-medium text-muted-foreground">{k('perMonth')}</span></p>
        ) : monthly === 0 && ticketFee === 0 ? (
          <p className="text-3xl font-bold text-foreground">{k('free')}</p>
        ) : showYearly ? (
          <p className="text-3xl font-bold text-foreground">{eur(yearlyPrice, i18n.language)}<span className="text-base font-medium text-muted-foreground">{k('perYear')}</span></p>
        ) : (
          <p className="text-3xl font-bold text-foreground">{eur(monthly, i18n.language)}<span className="text-base font-medium text-muted-foreground">{k('perMonth')}</span></p>
        )}
        {ticketFee > 0 ? (
          <p className="mt-1 text-sm font-semibold text-foreground">{k('per_ticket', { fee: eur(ticketFee, i18n.language) })}</p>
        ) : null}
        {minTerm > 0 ? (
          <p className="mt-1 text-xs font-medium text-foreground">{k('min_term', { n: minTerm })}</p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          {ticketFee > 0 ? k('free_tickets_free') : monthly > 0 ? `${k('exclVatShort')}${!yearly && yearlyPrice > 0 ? ` · ${k('yearly_short', { price: eur(yearlyPrice, i18n.language) })}` : ''}` : k('no_card')}
        </p>
      </div>
      <ul className="mt-6 flex-1 space-y-2.5">
        {lines.map((l) => (
          <li key={l} className="flex items-start gap-2 text-sm text-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />{l}</li>
        ))}
        {note ? <li className="flex items-start gap-2 text-sm text-muted-foreground"><Minus className="mt-0.5 h-4 w-4 shrink-0" />{note}</li> : null}
      </ul>
      <Link
        to={to}
        data-akke-goal={isEnterprise ? 'Offerte enterprise' : 'Start gratis'}
        className={cn('mt-7 inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          featured ? 'bg-accent text-accent-foreground hover:bg-accent/90' : 'border-2 border-border text-foreground hover:border-foreground')}
      >
        {isEnterprise ? k('cta_contact') : monthly === 0 ? k('cta_free') : k('cta_trial')}
      </Link>
    </div>
  );
}

export function PricingSection({ initialTab = 'retail', heading = true }: { initialTab?: PricingTab; heading?: boolean }) {
  const { t, i18n } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`landing.pricing.${x}`, o);
  const { plans, isLoading } = usePricingPlans();
  const { addons } = usePlatformAddons();
  const [yearly, setYearly] = useState(false);
  const tabs = useMemo(
    () => (Object.keys(TAB_TRACK) as PricingTab[]).filter((tab) => plans.some((p) => planTrack(p) === TAB_TRACK[tab])),
    [plans],
  );
  const [tab, setTab] = useState<PricingTab>(initialTab);
  const active: PricingTab = tabs.includes(tab) ? tab : 'retail';
  const shown = plans.filter((p) => planTrack(p) === TAB_TRACK[active]);
  const hasYearly = shown.some((p) => Number(p.yearly_price) > 0);
  // Add-ons die je bij dit spoor kan nemen (niet het spoor zelf).
  const tabAddons = addons.filter((a) => a.track !== TAB_TRACK[active]);

  return (
    <section id="pricing" className={cn('scroll-mt-24 bg-background', heading ? 'py-20 md:py-28' : 'pb-20 pt-2 md:pb-28')}>
      <div className="container mx-auto max-w-6xl px-4">
        {heading ? (
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">{k('heading')}</h2>
            <p className="mt-3 text-lg text-muted-foreground">{k('subheading')}</p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          {tabs.length > 1 ? (
            <div role="tablist" aria-label={k('tabs_label')} className="inline-flex rounded-xl border bg-card p-1">
              {tabs.map((id) => (
                <button key={id} type="button" role="tab" aria-selected={active === id} onClick={() => setTab(id)}
                  className={cn('h-10 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  {k(`tab_${id}`)}
                </button>
              ))}
            </div>
          ) : <span />}
          {hasYearly ? (
            <label className="flex items-center gap-3 text-sm font-medium text-foreground">
              {k('monthly')}
              <Switch checked={yearly} onCheckedChange={setYearly} className="data-[state=checked]:bg-accent" aria-label={k('yearly')} />
              {k('yearly')}
              <span className="text-xs font-semibold text-green-700">{k('save2months')}</span>
            </label>
          ) : null}
        </div>

        {isLoading ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[460px] rounded-2xl" />)}</div>
        ) : (
          <div className={cn('mt-8 grid gap-6', active === 'retail' ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3')}>
            {shown.map((p) => <PlanCard key={p.id} plan={p} yearly={yearly} featured={active === 'retail' ? p.highlighted : p.id === shown[0]?.id} />)}

            {active === 'horeca' ? (
              <div className="flex flex-col rounded-2xl border border-dashed border-border bg-card/60 p-6 md:p-7">
                <h3 className="text-xl font-bold text-foreground">{k('setup_title')}</h3>
                <p className="mt-1 min-h-[2.5rem] text-sm text-muted-foreground">{k('setup_by')}</p>
                <p className="mt-5 text-3xl font-bold text-foreground">{eur(SETUP_PRICE, i18n.language)}<span className="text-base font-medium text-muted-foreground"> {k('setup_once')}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">{k('exclVatShort')}</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {['setup_p1', 'setup_p2', 'setup_p3', 'setup_p4'].map((x) => (
                    <li key={x} className="flex items-start gap-2 text-sm text-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />{k(x)}</li>
                  ))}
                </ul>
                <Link to="/contact?onderwerp=horeca-opstart" className="mt-7 inline-flex h-11 items-center justify-center rounded-lg border-2 border-border px-4 text-sm font-semibold text-foreground hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {k('setup_cta')}
                </Link>
              </div>
            ) : null}

          </div>
        )}

        {/* PLANS-2 — combineren: een tweede spoor neem je als add-on, nooit als tweede plan. */}
        {!isLoading && tabAddons.length > 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 p-6 md:p-7">
            <h3 className="text-lg font-bold text-foreground">{k('addons_title')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{k('addons_text')}</p>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {tabAddons.map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>
                    <span className="font-semibold">{k(`addon_${a.track}`)}</span>
                    {' · '}
                    {a.monthly_price > 0
                      ? k('addon_price', { price: eur(a.monthly_price, i18n.language) })
                      : k('per_ticket', { fee: eur(a.ticket_fee, i18n.language) })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-10 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <p>{k('foot_trial')}</p>
          <p>{k('foot_payments')}</p>
          <p>{k('foot_qr')}</p>
          <p>{k('footnoteVat')}</p>
        </div>
      </div>
    </section>
  );
}
