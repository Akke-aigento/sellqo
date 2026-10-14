// MKT-2 — wat in elke SellQo zit. Alleen functies die vandaag werken, met het plan erbij
// waar dat uitmaakt.
import { BadgePercent, Boxes, FileText, Globe, Link2, Monitor, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ITEMS: { id: string; icon: LucideIcon }[] = [
  { id: 'shop', icon: Globe },
  { id: 'pos', icon: Monitor },
  { id: 'orders', icon: Boxes },
  { id: 'invoices', icon: FileText },
  { id: 'bol', icon: Link2 },
  { id: 'promos', icon: BadgePercent },
];

export function FeaturesSection() {
  const { t } = useTranslation();
  const k = (x: string) => t(`landing.core.${x}`);
  return (
    <section id="features" className="scroll-mt-24 bg-secondary/20 py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">{k('heading')}</h2>
          <p className="mt-3 text-lg text-muted-foreground">{k('subheading')}</p>
        </div>
        <dl className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map(({ id, icon: Icon }) => (
            <div key={id}>
              <dt className="flex items-center gap-3 text-lg font-semibold text-foreground">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                {k(`${id}_title`)}
              </dt>
              <dd className="mt-3 leading-relaxed text-muted-foreground">{k(`${id}_text`)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
