// MKT-4 — geen verzonnen klantcitaten meer. Wat we wel kunnen tonen: zaken die vandaag
// op SellQo draaien en echte bestellingen verwerken (nagekeken in de live-DB, 14-10).
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SHOPS = [
  { id: 'vanxcel', name: 'VanXcel', url: 'https://vanxcel.com' },
  { id: 'fonske', name: 'The Fonske Crawl', url: 'https://fonskecrawl.com' },
];

export function TestimonialsSection() {
  const { t } = useTranslation();
  const k = (x: string) => t(`landing.running.${x}`);
  return (
    <section className="bg-secondary/20 py-20 md:py-24">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">{k('heading')}</h2>
          <p className="mt-3 text-lg text-muted-foreground">{k('subheading')}</p>
        </div>
        <ul className="mt-10 grid gap-6 md:grid-cols-2">
          {SHOPS.map((s) => (
            <li key={s.id} className="flex flex-col rounded-2xl border border-border bg-card p-6">
              <span className="text-xl font-bold text-foreground">{s.name}</span>
              <span className="mt-1 text-sm font-medium text-accent">{k(`${s.id}_what`)}</span>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{k(`${s.id}_uses`)}</p>
              <a href={s.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
                {s.url.replace('https://', '')}<ExternalLink className="h-3.5 w-3.5" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
