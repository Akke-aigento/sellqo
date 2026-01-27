import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Target, Users, Zap, Heart, Globe, Shield } from 'lucide-react';

const values = [
  {
    icon: Target,
    title: 'Eenvoud Eerst',
    description: 'Complexe e-commerce processen versimpelen tot intuïtieve workflows.',
  },
  {
    icon: Users,
    title: 'Ondernemers Centraal',
    description: 'Elke feature is ontworpen met MKB ondernemers in gedachten.',
  },
  {
    icon: Zap,
    title: 'Innovatie Door AI',
    description: 'Slimme automatisering die jou tijd bespaart en groei stimuleert.',
  },
  {
    icon: Heart,
    title: 'Made in Belgium',
    description: 'Met trots ontwikkeld in België, voor de Benelux markt.',
  },
  {
    icon: Globe,
    title: 'Lokaal & Globaal',
    description: 'Ondersteuning voor lokale betaalmethoden én internationale groei.',
  },
  {
    icon: Shield,
    title: 'Privacy & Veiligheid',
    description: 'GDPR-compliant met focus op databescherming en transparantie.',
  },
];

export default function About() {
  return (
    <PublicPageLayout 
      title="Over SellQo" 
      subtitle="De Belgische e-commerce oplossing die groeit met jouw ambities"
    >
      {/* Mission Section */}
      <section className="max-w-4xl mx-auto mb-16">
        <div className="bg-card rounded-2xl border border-border p-8 md:p-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">Onze Missie</h2>
          <p className="text-lg text-muted-foreground mb-6">
            Bij SellQo geloven we dat elk bedrijf, groot of klein, toegang verdient tot professionele 
            e-commerce tools. We bouwen de meest complete en gebruiksvriendelijke oplossing voor 
            ondernemers in de Benelux - van eerste product tot internationale expansie.
          </p>
          <p className="text-muted-foreground">
            Opgericht in 2024, combineert SellQo de kracht van AI met diepgaande kennis van de lokale 
            markt. Of je nu verkoopt via je eigen webshop, Bol.com, Amazon of fysieke winkel - wij 
            brengen alles samen in één platform.
          </p>
        </div>
      </section>

      {/* Values Grid */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Onze Waarden</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {values.map((value, index) => (
            <div 
              key={index}
              className="bg-card rounded-xl border border-border p-6 hover:border-accent/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <value.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{value.title}</h3>
              <p className="text-sm text-muted-foreground">{value.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team Section Placeholder */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Het Team</h2>
        <div className="bg-secondary/30 rounded-2xl p-12 text-center">
          <p className="text-muted-foreground mb-4">
            Een klein maar toegewijd team van ontwikkelaars, designers en e-commerce experts.
          </p>
          <p className="text-sm text-muted-foreground">
            Meer informatie volgt binnenkort.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Klaar om te starten?
        </h2>
        <p className="text-muted-foreground mb-6">
          Probeer SellQo 14 dagen gratis en ontdek het verschil.
        </p>
        <Button asChild size="lg">
          <Link to="/auth?mode=register">Start Gratis Trial</Link>
        </Button>
      </section>
    </PublicPageLayout>
  );
}
