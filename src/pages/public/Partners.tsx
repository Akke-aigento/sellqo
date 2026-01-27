import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Handshake, Users, TrendingUp, Gift, Briefcase, HeartHandshake } from 'lucide-react';

const partnerTypes = [
  {
    icon: Briefcase,
    title: 'Agency Partners',
    description: 'Voor webdesign en marketing bureaus die SellQo aan klanten willen aanbieden.',
    benefits: ['Commissie op doorverwijzingen', 'Prioriteit support', 'Co-marketing mogelijkheden'],
  },
  {
    icon: TrendingUp,
    title: 'Reseller Partners',
    description: 'Verkoop SellQo licenties aan je eigen klantenbase met aantrekkelijke marges.',
    benefits: ['Volume kortingen', 'White-label opties', 'Dedicated account manager'],
  },
  {
    icon: HeartHandshake,
    title: 'Technology Partners',
    description: 'Integreer je software of dienst met het SellQo platform.',
    benefits: ['API toegang', 'Technische ondersteuning', 'Marketplace listing'],
  },
];

const benefits = [
  { icon: Gift, title: 'Aantrekkelijke Commissies', description: 'Verdien tot 20% recurring commissie op doorverwezen klanten.' },
  { icon: Users, title: 'Dedicated Support', description: 'Direct contact met ons partner team voor al je vragen.' },
  { icon: TrendingUp, title: 'Groei Samen', description: 'Toegang tot training, marketing materialen en co-branding.' },
];

export default function Partners() {
  return (
    <PublicPageLayout 
      title="Partner Programma" 
      subtitle="Groei samen met SellQo en help ondernemers succesvol verkopen"
    >
      {/* Partner Types */}
      <section className="max-w-5xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Word Partner</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {partnerTypes.map((type, index) => (
            <div 
              key={index}
              className="bg-card rounded-xl border border-border p-6 hover:border-accent/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <type.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{type.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{type.description}</p>
              <ul className="space-y-2">
                {type.benefits.map((benefit, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-4xl mx-auto mb-16">
        <div className="bg-gradient-to-br from-accent/10 to-primary/10 rounded-2xl border border-accent/30 p-8">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Partner Voordelen</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Interesse om partner te worden?
        </h2>
        <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
          Neem contact met ons op en ontdek hoe we samen kunnen groeien.
        </p>
        <Button asChild size="lg">
          <Link to="/contact">Neem Contact Op</Link>
        </Button>
      </section>
    </PublicPageLayout>
  );
}
