import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Check, Star, Sparkles, Monitor, Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';

const planMeta = [
  {
    key: 'free',
    price: 0,
    yearlyPrice: 0,
    hasLimitations: true,
    highlighted: false,
  },
  {
    key: 'starter',
    price: 29,
    yearlyPrice: 290,
    hasAddons: true,
    highlighted: false,
  },
  {
    key: 'pro',
    price: 79,
    yearlyPrice: 790,
    highlighted: true,
  },
  {
    key: 'enterprise',
    price: 199,
    yearlyPrice: 1990,
    highlighted: false,
  },
];

const addonMeta = [
  { icon: Sparkles, key: 'ai', price: 19 },
  { icon: Monitor, key: 'pos', price: 29, proPricing: 0 },
  { icon: FileText, key: 'peppol', price: 12, proPricing: 0, hasUrgency: true },
  { icon: Plus, key: 'marketplace', price: 15 },
];

export function PricingSection() {
  const { ref, isIntersecting } = useIntersectionObserver();
  const [isYearly, setIsYearly] = useState(false);
  const { t } = useTranslation();

  return (
    <section id="pricing" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-12',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t('landing.pricing.heading')}
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            {t('landing.pricing.subheading')}
          </p>
          
          {/* Monthly/Yearly Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={cn(
              'text-sm font-medium transition-colors',
              !isYearly ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {t('landing.pricing.monthly')}
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-accent"
            />
            <span className={cn(
              'text-sm font-medium transition-colors',
              isYearly ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {t('landing.pricing.yearly')}
            </span>
            {isYearly && (
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                {t('landing.pricing.save2months')}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 max-w-6xl mx-auto mb-16 items-stretch">
          {planMeta.map((plan, index) => {
            const name = t(`landing.pricing.plans.${plan.key}.name`);
            const badge = t(`landing.pricing.plans.${plan.key}.badge`);
            const cta = t(`landing.pricing.plans.${plan.key}.cta`);
            const features = t(`landing.pricing.plans.${plan.key}.features`, { returnObjects: true }) as string[];
            const limitations = plan.hasLimitations
              ? (t(`landing.pricing.plans.${plan.key}.limitations`, { returnObjects: true }) as string[])
              : null;
            const addons = plan.hasAddons
              ? (t(`landing.pricing.plans.${plan.key}.addons`, { returnObjects: true }) as string[])
              : null;
            return (
            <div
              key={index}
              className={cn(
                'relative p-6 md:p-8 rounded-2xl border transition-all duration-300 flex flex-col',
                plan.highlighted
                  ? 'bg-card border-accent shadow-lg scale-105 z-10'
                  : 'bg-card border-border shadow-sellqo hover:shadow-sellqo-lg hover:-translate-y-1',
                isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-accent text-accent-foreground px-4 py-1">
                    <Star className="w-3 h-3 mr-1 inline" />
                    {badge}
                  </Badge>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-foreground mb-2">{name}</h3>
                {!plan.highlighted && (
                  <Badge variant="secondary" className="mb-4">{badge}</Badge>
                )}
                <div className="mb-2">
                  {isYearly && plan.yearlyPrice > 0 ? (
                    <>
                      <span className="text-4xl font-bold text-foreground">
                        €{plan.yearlyPrice}
                      </span>
                      <span className="text-muted-foreground">{t('landing.pricing.perYear')}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-foreground">
                        {plan.price === 0 ? t('landing.pricing.free') : `€${plan.price}`}
                      </span>
                      {plan.price > 0 && <span className="text-muted-foreground">{t('landing.pricing.perMonth')}</span>}
                    </>
                  )}
                </div>
                {!isYearly && plan.yearlyPrice > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t('landing.pricing.yearlyHint', { price: plan.yearlyPrice })}
                  </p>
                )}
              </div>

              {/* Features list with flex-grow to push button to bottom */}
              <div className="flex-grow">
                <ul className="space-y-3 mb-6">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {limitations && (
                  <ul className="space-y-2 mb-6 pt-4 border-t border-border">
                    {limitations.map((limitation, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        {limitation}
                      </li>
                    ))}
                  </ul>
                )}

                {addons && (
                  <div className="pt-4 border-t border-border mb-6">
                    <p className="text-xs text-muted-foreground mb-2">{t('landing.pricing.availableAddons')}</p>
                    <div className="flex flex-wrap gap-1">
                      {addons.map((addon, i) => (
                        <span key={i} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">
                          +{addon}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Button always at bottom */}
              <div className="mt-auto pt-4">
                <Button
                  asChild
                  className={cn(
                    'w-full',
                    plan.highlighted
                      ? 'bg-accent hover:bg-accent/90 text-accent-foreground'
                      : ''
                  )}
                  variant={plan.highlighted ? 'default' : 'outline'}
                  size="lg"
                >
                  <Link to={plan.key === 'enterprise' ? '/contact' : '/auth?mode=register'}>
                    {cta}
                  </Link>
                </Button>
              </div>
            </div>
            );
          })}
        </div>

        {/* Add-ons Section */}
        <div
          className={cn(
            'max-w-4xl mx-auto',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
          style={{ animationDelay: '0.5s' }}
        >
          <h3 className="text-2xl font-bold text-foreground text-center mb-8">
            {t('landing.pricing.boostHeading')}
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {addonMeta.map((addon, index) => {
              const Icon = addon.icon;
              const name = t(`landing.pricing.addons.${addon.key}.name`);
              const desc = t(`landing.pricing.addons.${addon.key}.desc`);
              const features = t(`landing.pricing.addons.${addon.key}.features`, { returnObjects: true }) as string[];
              const forTier = t(`landing.pricing.addons.${addon.key}.for`);
              const urgency = addon.hasUrgency ? t(`landing.pricing.addons.${addon.key}.urgency`) : null;
              return (
              <div
                key={index}
                className="p-6 bg-card rounded-xl border border-border hover:border-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground">{name}</h4>
                      {urgency && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">
                          {urgency}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <span className="text-2xl font-bold text-foreground">€{addon.price}</span>
                  <span className="text-muted-foreground">{t('landing.pricing.perMonth')}</span>
                  {addon.proPricing === 0 && (
                    <p className="text-xs text-green-600 mt-1">{t('landing.pricing.freeAtPro')}</p>
                  )}
                  {addon.proPricing && addon.proPricing > 0 && (
                    <p className="text-xs text-accent mt-1">{t('landing.pricing.atPro', { price: addon.proPricing })}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('landing.pricing.availableFor', { tier: forTier })}
                </p>
                <ul className="space-y-2">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-3 h-3 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              );
            })}
          </div>
        </div>

        <div className="text-center mt-12 space-y-4">
          <p
            className="text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: t('landing.pricing.footnoteTrial') }}
          />
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-sm text-green-700 dark:text-green-400">
              💡 <strong>{t('landing.pricing.footnoteTipTitle')}</strong> {t('landing.pricing.footnoteTipBody')}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('landing.pricing.footnoteStripe')}
          </p>
          <p className="text-sm text-muted-foreground font-medium">
            {t('landing.pricing.footnoteVat')}
          </p>
        </div>
      </div>
    </section>
  );
}
