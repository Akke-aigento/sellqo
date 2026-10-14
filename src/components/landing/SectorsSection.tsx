// MKT-2 — één kern, drie soorten zaken. Elke kolom eindigt bij iets echts: een
// sectorpagina of een live demowinkel.
import { Link } from 'react-router-dom';
import { ExternalLink, ShoppingBag, Ticket, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SECTORS: { id: 'retail' | 'horeca' | 'events'; icon: LucideIcon; more?: string; demo: string }[] = [
  { id: 'retail', icon: ShoppingBag, demo: 'https://demo-webshop.sellqo.shop/' },
  { id: 'horeca', icon: UtensilsCrossed, more: '/horeca', demo: 'https://demo-pizzeria.sellqo.shop/' },
  { id: 'events', icon: Ticket, more: '/events', demo: 'https://fonskecrawl.com/' },
];

export function SectorsSection() {
  const { t } = useTranslation();
  const k = (x: string) => t(`landing.sectors.${x}`);
  return (
    <section className="bg-background py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">{k('heading')}</h2>
          <p className="mt-3 text-lg text-muted-foreground">{k('subheading')}</p>
        </div>
        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-border">
          {SECTORS.map(({ id, icon: Icon, more, demo }) => (
            <div key={id} className="flex flex-col md:px-8 md:first:pl-0 md:last:pr-0">
              <Icon className="h-8 w-8 text-accent" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-bold text-foreground">{k(`${id}_title`)}</h3>
              <p className="mt-2 text-muted-foreground">{k(`${id}_text`)}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-foreground">
                {['p1', 'p2', 'p3'].map((p) => <li key={p} className="border-l-2 border-accent/40 pl-3">{k(`${id}_${p}`)}</li>)}
              </ul>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
                {more ? <Link to={more} className="text-primary underline-offset-4 hover:underline">{k(`${id}_more`)}</Link> : <a href="#features" className="text-primary underline-offset-4 hover:underline">{k(`${id}_more`)}</a>}
                <a href={demo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">{k(`${id}_demo`)}<ExternalLink className="h-3.5 w-3.5" /></a>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-12 text-center">
          <Link to="/voorbeelden" className="inline-flex items-center gap-2 rounded-lg border-2 border-border px-6 py-3 font-semibold text-foreground hover:border-primary">
            {t('landing.sector.common.demo_all')}
          </Link>
        </p>
      </div>
    </section>
  );
}
