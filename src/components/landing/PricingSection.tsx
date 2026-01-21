import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Check, Star, Sparkles, Monitor, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

const plans = [
  {
    name: 'Free',
    price: 0,
    yearlyPrice: 0,
    badge: 'Om te starten',
    features: [
      'Tot 25 bestellingen/maand',
      '50 producten',
      'Basis voorraad',
      'Handmatige facturen',
      'Community support',
    ],
    limitations: ['Geen webshop', 'Geen AI', 'Geen POS'],
    cta: 'Start Gratis',
    highlighted: false,
  },
  {
    name: 'Starter',
    price: 29,
    yearlyPrice: 290,
    badge: 'Perfect voor starters',
    features: [
      'Tot 250 bestellingen/maand',
      'Onbeperkte producten',
      '1 verkoopkanaal',
      'Automatische facturen (Factur-X)',
      'Basis promoties (kortingscodes)',
      'Email support',
    ],
    cta: 'Start Gratis',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 79,
    yearlyPrice: 790,
    badge: 'Meest gekozen',
    features: [
      'Onbeperkte bestellingen',
      'Onbeperkte verkoopkanalen',
      '✨ AI Marketing Hub (500 credits/maand)',
      '🛒 Webshop Builder + 1 premium theme',
      '📊 Advanced analytics & SEO tools',
      'Multi-warehouse management',
      '8 promotietypen + Loyaliteit',
      'Peppol e-invoicing',
      'Priority support',
      'API toegang',
    ],
    cta: 'Start Gratis',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 199,
    yearlyPrice: 1990,
    badge: 'Voor schaalbare businesses',
    features: [
      'Alles van Pro, onbeperkt',
      '✨ Onbeperkte AI credits',
      '🛒 Alle premium themes',
      '💳 POS systeem inclusief',
      'Dedicated account manager',
      'Phone support (NL/BE)',
      'Gratis migratie (€2000 waarde)',
      'Custom integraties',
      'White-label opties',
      'SLA 99.9%',
    ],
    cta: 'Neem Contact Op',
    highlighted: false,
  },
];

const addons = [
  {
    icon: Sparkles,
    name: 'AI Marketing Pack',
    price: 19,
    description: '500 extra AI credits/maand',
    features: ['Social post generator', 'Email planner', 'A/B testing'],
  },
  {
    icon: Monitor,
    name: 'POS Kassa',
    price: 29,
    proPricing: 15,
    description: 'Verkoop in je winkel',
    features: ['Touch interface', 'Barcode scanning', 'Stripe Terminal'],
  },
  {
    icon: Plus,
    name: 'Extra Kanaal',
    price: 15,
    description: 'Per marketplace/shop',
    features: ['Order sync', 'Voorraad sync', 'Klant sync'],
  },
];

export function PricingSection() {
  const { ref, isIntersecting } = useIntersectionObserver();
  const [isYearly, setIsYearly] = useState(false);

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
            Transparante Prijzen, Schaalbaar Met Jouw Groei
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Begin gratis, upgrade wanneer je wilt. Geen verborgen kosten.
          </p>
          
          {/* Monthly/Yearly Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={cn(
              'text-sm font-medium transition-colors',
              !isYearly ? 'text-foreground' : 'text-muted-foreground'
            )}>
              Maandelijks
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
              Jaarlijks
            </span>
            {isYearly && (
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                Bespaar 2 maanden
              </Badge>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 max-w-6xl mx-auto mb-16">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={cn(
                'relative p-6 md:p-8 rounded-2xl border transition-all duration-300',
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
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                {!plan.highlighted && (
                  <Badge variant="secondary" className="mb-4">{plan.badge}</Badge>
                )}
                <div className="mb-2">
                  {isYearly && plan.yearlyPrice > 0 ? (
                    <>
                      <span className="text-4xl font-bold text-foreground">
                        €{plan.yearlyPrice}
                      </span>
                      <span className="text-muted-foreground">/jaar</span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-foreground">
                        {plan.price === 0 ? 'Gratis' : `€${plan.price}`}
                      </span>
                      {plan.price > 0 && <span className="text-muted-foreground">/maand</span>}
                    </>
                  )}
                </div>
                {!isYearly && plan.yearlyPrice > 0 && (
                  <p className="text-sm text-muted-foreground">
                    €{plan.yearlyPrice} per jaar (bespaar 2 maanden)
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.limitations && (
                <ul className="space-y-2 mb-6 pt-4 border-t border-border">
                  {plan.limitations.map((limitation, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {limitation}
                    </li>
                  ))}
                </ul>
              )}

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
                <Link to={plan.name === 'Enterprise' ? '/contact' : '/auth?mode=register'}>
                  {plan.cta}
                </Link>
              </Button>
            </div>
          ))}
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
            Boost Je Plan Met Add-ons
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            {addons.map((addon, index) => (
              <div
                key={index}
                className="p-6 bg-card rounded-xl border border-border hover:border-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <addon.icon className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">{addon.name}</h4>
                    <p className="text-sm text-muted-foreground">{addon.description}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <span className="text-2xl font-bold text-foreground">€{addon.price}</span>
                  <span className="text-muted-foreground">/maand</span>
                  {addon.proPricing && (
                    <p className="text-xs text-accent mt-1">€{addon.proPricing}/maand bij Pro</p>
                  )}
                </div>
                <ul className="space-y-2">
                  {addon.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-3 h-3 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-12 space-y-4">
          <p className="text-muted-foreground">
            Alle plannen: <strong>14 dagen gratis</strong> • Geen creditcard nodig • Maandelijks opzegbaar
          </p>
          <p className="text-sm text-muted-foreground">
            Alleen Stripe betaalkosten: 1,5% + €0,25 per transactie • Geen extra transactiekosten
          </p>
        </div>
      </div>
    </section>
  );
}
