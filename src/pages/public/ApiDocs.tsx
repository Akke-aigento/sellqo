import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Code, Lock, Book } from 'lucide-react';

export default function ApiDocs() {
  return (
    <PublicPageLayout
      title="API-toegang"
      subtitle="Beschikbaar op aanvraag voor Enterprise-klanten"
    >
      <section className="max-w-2xl mx-auto mb-12">
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-6 text-center">
          <Code className="w-10 h-10 text-accent mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">
            API-toegang op aanvraag
          </h2>
          <p className="text-muted-foreground">
            De SellQo API is beschikbaar voor Enterprise-klanten die diepere integraties nodig hebben.
          </p>
        </div>
      </section>

      <section className="max-w-2xl mx-auto mb-12 space-y-4">
        <div className="bg-card rounded-xl border border-border p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Code className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Moderne REST API</h3>
            <p className="text-sm text-muted-foreground">
              Voorspelbare endpoints voor producten, bestellingen, klanten en meer.
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Veilige authenticatie</h3>
            <p className="text-sm text-muted-foreground">
              Toegang wordt afgeschermd met per-tenant credentials en fijnmazige rechten.
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Book className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Documentatie bij onboarding</h3>
            <p className="text-sm text-muted-foreground">
              We leveren volledige documentatie en begeleiding zodra je Enterprise-toegang is geactiveerd.
            </p>
          </div>
        </div>
      </section>

      <section className="text-center max-w-xl mx-auto">
        <h2 className="text-xl font-bold text-foreground mb-4">
          API-toegang aanvragen?
        </h2>
        <p className="text-muted-foreground mb-6">
          Neem contact met ons op — dan bespreken we samen je use-case en implementatie.
        </p>
        <Button asChild>
          <Link to="/contact">Neem contact op</Link>
        </Button>
      </section>
    </PublicPageLayout>
  );
}