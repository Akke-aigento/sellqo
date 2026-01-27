import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

type CellValueType = boolean | string | 'partial';

const comparisonData: Array<{
  feature: string;
  sellqo: CellValueType;
  shopify: CellValueType;
  lightspeed: CellValueType;
  custom: CellValueType;
}> = [
  { feature: 'Setup tijd', sellqo: '5 minuten', shopify: '1-2 uur', lightspeed: '2-4 uur', custom: 'Weken' },
  { feature: 'Maandelijkse kosten', sellqo: 'Vanaf €29', shopify: 'Vanaf €36', lightspeed: 'Vanaf €59', custom: 'Variabel' },
  { feature: 'Transactiekosten SellQo', sellqo: '€0 (bank QR)', shopify: 'N/A', lightspeed: 'N/A', custom: 'N/A' },
  { feature: 'Shop Health Score', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { feature: 'Proactieve AI Coach', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { feature: 'Gamification & Badges', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { feature: 'Live Activity Feed', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { feature: 'Multi-channel management', sellqo: true, shopify: 'partial', lightspeed: 'partial', custom: false },
  { feature: 'Voorraadsync', sellqo: true, shopify: 'partial', lightspeed: true, custom: false },
  { feature: 'AI Marketing Tools', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { feature: 'AI Productbeschrijvingen', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { feature: 'AI Afbeelding Generatie', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { feature: 'Ingebouwde Webshop Builder', sellqo: true, shopify: true, lightspeed: false, custom: true },
  { feature: 'POS Kassasysteem', sellqo: true, shopify: true, lightspeed: true, custom: false },
  { feature: 'Loyaliteitsprogramma', sellqo: true, shopify: 'partial', lightspeed: 'partial', custom: false },
  { feature: 'Cadeaubonnen systeem', sellqo: true, shopify: 'partial', lightspeed: 'partial', custom: false },
  { feature: 'BTW/OSS compliance', sellqo: true, shopify: 'partial', lightspeed: 'partial', custom: false },
  { feature: 'Bol.com VVB Labels', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { feature: 'Peppol e-invoicing', sellqo: true, shopify: false, lightspeed: false, custom: 'partial' },
  { feature: 'WhatsApp Order Alerts', sellqo: true, shopify: 'partial', lightspeed: false, custom: false },
  { feature: 'Nederlandse support', sellqo: true, shopify: false, lightspeed: true, custom: 'partial' },
  { feature: 'Gratis migratie', sellqo: true, shopify: false, lightspeed: false, custom: false },
];

const platforms = [
  { key: 'sellqo', name: 'SellQo', highlight: true },
  { key: 'shopify', name: 'Shopify', highlight: false },
  { key: 'lightspeed', name: 'Lightspeed', highlight: false },
  { key: 'custom', name: 'Custom', highlight: false },
];

function CellValue({ value }: { value: CellValueType }) {
  if (value === 'partial') {
    return (
      <div className="flex flex-col items-center">
        <Check className="w-5 h-5 text-amber-500" />
        <span className="text-xs text-amber-600">(via app)</span>
      </div>
    );
  }
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

        {/* Legend */}
        <div
          className={cn(
            'flex flex-wrap justify-center gap-6 mt-6 text-sm',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
          style={{ animationDelay: '0.3s' }}
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-muted-foreground">Inbegrepen</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-amber-500" />
            <span className="text-muted-foreground">Via betaalde app</span>
          </div>
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 text-red-400" />
            <span className="text-muted-foreground">Niet beschikbaar</span>
          </div>
        </div>
      </div>
    </section>
  );
}
