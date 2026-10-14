// MKT-4 — alleen feiten die kloppen. (Vroeger: verzonnen tellers "500+ ondernemers",
// "€2,4M omzet", "99,9% uptime".)
import { useTranslation } from 'react-i18next';

const FACTS = ['one', 'trial', 'languages', 'belgium'] as const;

export function SocialProofSection() {
  const { t } = useTranslation();
  return (
    <section className="border-b border-border bg-background py-10 md:py-12">
      <dl className="container mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-4 md:grid-cols-4">
        {FACTS.map((f) => (
          <div key={f} className="md:border-l md:border-border md:pl-6 md:first:border-l-0 md:first:pl-0">
            <dt className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">{t(`landing.facts.${f}`)}</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{t(`landing.facts.${f}_label`)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
