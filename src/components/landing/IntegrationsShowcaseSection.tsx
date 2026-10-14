// MKT-3 — koppelingen: alleen wat vandaag werkt, groot. Wat eraan komt, in één regel.
// (Vroeger 22 tegels waarvan 16 "binnenkort" — dat leest als vaporware.)
import { useTranslation } from 'react-i18next';

const LIVE: { name: string; key: string }[] = [
  { name: 'bol.com', key: 'bol' },
  { name: 'Stripe', key: 'stripe' },
  { name: 'Bancontact', key: 'bancontact' },
  { name: 'iDEAL', key: 'ideal' },
  { name: 'Odoo', key: 'odoo' },
  { name: 'Peppol', key: 'peppol' },
];

export function IntegrationsShowcaseSection() {
  const { t } = useTranslation();
  const k = (x: string) => t(`landing.links.${x}`);
  return (
    <section className="bg-background py-20 md:py-24">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-end">
          <div>
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">{k('heading')}</h2>
            <p className="mt-3 text-lg text-muted-foreground">{k('subheading')}</p>
          </div>
          <p className="text-sm text-muted-foreground lg:text-right">{k('soon')}</p>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          {LIVE.map(({ name, key }) => (
            <li key={key} className="flex flex-col bg-card p-5">
              <span className="text-xl font-bold tracking-tight text-foreground">{name}</span>
              <span className="mt-2 text-sm leading-snug text-muted-foreground">{k(key)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
