import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Building2, Send } from 'lucide-react';

export default function Careers() {
  return (
    <PublicPageLayout
      title="Werken met SellQo"
      subtitle="Een jong Belgisch platform, gebouwd door Nomadix BV"
    >
      <section className="max-w-2xl mx-auto">
        <div className="bg-card rounded-2xl border border-border p-8 md:p-10">
          <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-6">
            <Building2 className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Geen openstaande vacatures — wél open voor samenwerking
          </h2>
          <p className="text-muted-foreground mb-4">
            SellQo is een jong e-commerce platform, gebouwd en beheerd door{' '}
            <span className="font-medium text-foreground">Nomadix BV</span> in België.
            Op dit moment hebben we geen openstaande vacatures.
          </p>
          <p className="text-muted-foreground mb-8">
            Spontane sollicitaties en freelance-samenwerkingen (development, design,
            e-commerce, marketing) zijn wel welkom. Stuur ons een bericht via het
            contactformulier — we lezen elke aanvraag persoonlijk.
          </p>
          <Button asChild size="lg">
            <Link to="/contact">
              <Send className="w-4 h-4 mr-2" />
              Neem contact op
            </Link>
          </Button>
        </div>
      </section>
    </PublicPageLayout>
  );
}
