import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

const comparisonData = [
  { feature: 'Setup tijd', sellqo: '5 minuten', shopify: '1-2 uur', lightspeed: '2-4 uur', custom: 'Weken' },
  { feature: 'Maandelijkse kosten', sellqo: 'Vanaf €29', shopify: 'Vanaf €36', lightspeed: 'Vanaf €59', custom: 'Variabel' },
  { feature: 'Transactiekosten', sellqo: true, shopify: false, lightspeed: false, custom: true },
  { feature: 'Multi-channel management', sellqo: true, shopify: false, lightspeed: true, custom: false },
  { feature: 'Voorraadsync', sellqo: true, shopify: false, lightspeed: true, custom: false },
  { feature: 'AI Marketing Tools', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { feature: 'Ingebouwde Webshop Builder', sellqo: true, shopify: true, lightspeed: false, custom: true },
  { feature: 'POS Kassasysteem', sellqo: true, shopify: true, lightspeed: true, custom: false },
  { feature: 'Loyaliteitsprogramma', sellqo: true, shopify: false, lightspeed: true, custom: false },
  { feature: 'Cadeaubonnen systeem', sellqo: true, shopify: true, lightspeed: true, custom: false },
  { feature: 'BTW/OSS compliance', sellqo: true, shopify: false, lightspeed: true, custom: false },
  { feature: 'Peppol e-invoicing', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { feature: 'Nederlandse support', sellqo: true, shopify: false, lightspeed: true, custom: false },
  { feature: 'Gratis migratie', sellqo: true, shopify: false, lightspeed: false, custom: false },
];

const platforms = [
  { key: 'sellqo', name: 'SellQo', highlight: true },
  { key: 'shopify', name: 'Shopify', highlight: false },
  { key: 'lightspeed', name: 'Lightspeed', highlight: false },
  { key: 'custom', name: 'Custom', highlight: false },
];

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="w-5 h-5 text-green-500 mx-auto" />
    ) : (
      <X className="w-5 h-5 text-red-400 mx-auto" />
    );
  }
  return <span>{value}</span>;
}

export function ComparisonSection() {
  const { ref, isIntersecting } = useIntersectionObserver();

  return (
    <section className="py-20 md:py-28 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-12',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            SellQo vs De Rest
          </h2>
        </div>

        <div
          className={cn(
            'overflow-x-auto',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
          style={{ animationDelay: '0.2s' }}
        >
          <table className="w-full min-w-[640px] bg-card rounded-2xl border border-border shadow-sellqo overflow-hidden">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-left text-foreground font-semibold">Feature</th>
                {platforms.map((platform) => (
                  <th
                    key={platform.key}
                    className={cn(
                      'p-4 text-center font-semibold',
                      platform.highlight ? 'bg-accent/10 text-accent' : 'text-foreground'
                    )}
                  >
                    {platform.name}
                    {platform.highlight && (
                      <span className="block text-xs font-normal mt-1">⭐ Aanbevolen</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  <td className="p-4 text-foreground">{row.feature}</td>
                  {platforms.map((platform) => (
                    <td
                      key={platform.key}
                      className={cn(
                        'p-4 text-center',
                        platform.highlight && 'bg-accent/5'
                      )}
                    >
                      <CellValue value={row[platform.key as keyof typeof row]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
