import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { TrendingUp, Briefcase, HeartHandshake, Sparkles, MessageSquare, Users } from 'lucide-react';

const partnerTypes = [
  {
    icon: Briefcase,
    title: 'Agencies',
    description: 'Webdesign- en marketingbureaus die SellQo aan klanten willen aanbieden.',
    benefits: ['Early access tot nieuwe features', 'Directe lijn met het team', 'Meegroeien met het platform'],
  },
  {
    icon: TrendingUp,
    title: 'Freelancers',
    description: 'Freelance developers en consultants die SellQo willen aanbevelen of implementeren.',
    benefits: ['Early access tot nieuwe features', 'Directe lijn met het team', 'Meegroeien met het platform'],
  },
  {
    icon: HeartHandshake,
    title: 'Integrators',
    description: 'Bouw je eigen integratie of dienst bovenop het SellQo platform.',
    benefits: ['Early access tot nieuwe features', 'Directe lijn met het team', 'Meegroeien met het platform'],
  },
];

export default function Partners() {
  return (
    <PublicPageLayout 
      title="Partnerprogramma in opbouw" 
      subtitle="We bouwen ons partner-netwerk op — word founding partner"
    >
      {/* Intro */}
      <section className="max-w-3xl mx-auto text-center mb-12">
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-6">
          <Sparkles className="w-8 h-8 text-accent mx-auto mb-3" />
          <p className="text-foreground">
            SellQo is een jong Belgisch platform en we zijn ons partner-netwerk aan het opbouwen.
            Ben je bureau, freelancer of integrator? Werk met ons mee als founding partner en groei mee met het platform.
          </p>
        </div>
      </section>

      {/* Partner Types */}
      <section className="max-w-5xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Word founding partner</h2>
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

      {/* CTA */}
      <section className="text-center max-w-2xl mx-auto">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-6 h-6 text-accent" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Interesse om samen te werken?
        </h2>
        <p className="text-muted-foreground mb-6">
          Stuur ons een bericht via het contactformulier — kies "Partnership" als onderwerp
          en we komen bij je terug.
        </p>
        <Button asChild variant="outline" size="lg">
          <Link to="/contact">Neem Contact Op</Link>
        </Button>
      </section>
    </PublicPageLayout>
  );
}
