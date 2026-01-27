import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Briefcase, Heart, Rocket, Coffee } from 'lucide-react';

const perks = [
  { icon: Rocket, title: 'Startup Cultuur', description: 'Werk aan impactvolle projecten in een dynamische omgeving.' },
  { icon: Heart, title: 'Remote-First', description: 'Werk waar je wilt, met flexibele uren.' },
  { icon: Coffee, title: 'Moderne Tools', description: 'De beste tools en technologie tot je beschikking.' },
  { icon: Briefcase, title: 'Groei Mogelijkheden', description: 'Ontwikkel je skills en carrière bij een groeiend bedrijf.' },
];

export default function Careers() {
  return (
    <PublicPageLayout 
      title="Werken bij SellQo" 
      subtitle="Bouw mee aan de toekomst van e-commerce in de Benelux"
    >
      {/* Intro */}
      <section className="max-w-3xl mx-auto text-center mb-16">
        <p className="text-lg text-muted-foreground">
          Bij SellQo bouwen we software die duizenden ondernemers helpt hun dromen waar te maken. 
          We zoeken gepassioneerde mensen die willen bijdragen aan iets betekenisvols.
        </p>
      </section>

      {/* Perks */}
      <section className="max-w-4xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Wat we bieden</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {perks.map((perk, index) => (
            <div 
              key={index}
              className="bg-card rounded-xl border border-border p-6 text-center"
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <perk.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{perk.title}</h3>
              <p className="text-sm text-muted-foreground">{perk.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Open Positions */}
      <section className="max-w-3xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Open Posities</h2>
        <div className="bg-secondary/30 rounded-2xl p-12 text-center">
          <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">
            Momenteel hebben we geen openstaande vacatures.
          </p>
          <p className="text-sm text-muted-foreground">
            Maar we staan altijd open voor spontane sollicitaties van getalenteerde mensen!
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Geïnteresseerd in SellQo?
        </h2>
        <p className="text-muted-foreground mb-6">
          Stuur ons een bericht en vertel waarom jij bij het team past.
        </p>
        <Button asChild size="lg">
          <Link to="/contact">Spontaan Solliciteren</Link>
        </Button>
      </section>
    </PublicPageLayout>
  );
}
