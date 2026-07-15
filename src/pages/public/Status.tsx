import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Activity, ExternalLink, Mail } from 'lucide-react';

const STATUS_MONITOR_URL = '';

export default function Status() {
  return (
    <PublicPageLayout
      title="Systeem Status"
      subtitle="Transparant inzicht in de beschikbaarheid van SellQo"
    >
      <section className="max-w-2xl mx-auto mb-10">
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Activity className="w-7 h-7 text-accent" />
          </div>
          <p className="text-muted-foreground">
            SellQo publiceert de actuele status van het platform via een externe monitor.
            Zo weet je in één oogopslag of alles draait zoals verwacht.
          </p>
        </div>
      </section>

      <section className="max-w-2xl mx-auto mb-10 text-center">
        {STATUS_MONITOR_URL ? (
          <Button asChild size="lg">
            <a href={STATUS_MONITOR_URL} target="_blank" rel="noopener noreferrer">
              Bekijk live statuspagina
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Live statuspagina binnenkort beschikbaar.
          </p>
        )}
      </section>

      <section className="max-w-2xl mx-auto text-center">
        <p className="text-sm text-muted-foreground">
          Ondervind je een storing of onverwacht gedrag? Neem contact op via{' '}
          <a href="mailto:info@sellqo.app" className="text-accent hover:underline inline-flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" />
            info@sellqo.app
          </a>{' '}
          — we reageren zo snel mogelijk.
        </p>
      </section>
    </PublicPageLayout>
  );
}
