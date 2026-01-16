import { Link } from 'react-router-dom';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const plans = [
  {
    name: 'Free',
    price: 0,
    yearlyPrice: 0,
    badge: 'Om te starten',
    features: [
      'Tot 25 bestellingen/maand',
      '1 verkoopkanaal',
      'Basis voorraadmanagement',
      'Standaard facturen',
      'Community support',
    ],
    cta: 'Start Gratis',
    highlighted: false,
  },
  {
    name: 'Starter',
    price: 29,
    yearlyPrice: 290,
    badge: 'Perfect voor starters',
    features: [
      'Tot 100 bestellingen/maand',
      '2 verkoopkanalen',
      'Basis voorraadmanagement',
      'Automatische facturen (Factur-X)',
      'Email support',
      'Alle basis features',
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
      'Advanced analytics & rapporten',
      'Multi-warehouse management',
      'Peppol e-invoicing ready',
      'Priority email & chat support',
      'API toegang',
      'Alles van Starter',
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
      'Onbeperkt alles',
      'Dedicated account manager',
      'Phone support (NL/BE)',
      'Gratis migratie service (tot €2000 waarde)',
      'Custom integraties',
      'White-label opties',
      'SLA garantie 99.9%',
      'Alles van Pro',
    ],
    cta: 'Neem Contact Op',
    highlighted: false,
  },
];

export function PricingSection() {
  const { ref, isIntersecting } = useIntersectionObserver();

  return (
    <section id="pricing" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-16',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Transparante Prijzen, Schaalbaar Met Jouw Groei
          </h2>
          <p className="text-lg text-muted-foreground">
            Begin gratis, upgrade wanneer je wilt. Geen verborgen kosten.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 max-w-6xl mx-auto mb-12">
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
                  <span className="text-4xl font-bold text-foreground">
                    {plan.price === 0 ? 'Gratis' : `€${plan.price}`}
                  </span>
                  {plan.price > 0 && <span className="text-muted-foreground">/maand</span>}
                </div>
                {plan.yearlyPrice > 0 && (
                  <p className="text-sm text-muted-foreground">
                    €{plan.yearlyPrice} per jaar (bespaar 2 maanden)
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

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
                <Link to={plan.name === 'Business' ? '/contact' : '/auth?mode=register'}>
                  {plan.cta}
                </Link>
              </Button>
            </div>
          ))}
        </div>

        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            Alle plannen: <strong>14 dagen gratis</strong> • Geen creditcard nodig • Maandelijks opzegbaar
          </p>
          <p className="text-sm text-muted-foreground">
            Extra features: Premium thema's vanaf €99 • Webshop setup service €500-5000
          </p>
        </div>
      </div>
    </section>
  );
}
