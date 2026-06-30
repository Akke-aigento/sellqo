import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type CellValueType = boolean | string | 'partial';

type Row = { key: string; sellqo: CellValueType; shopify: CellValueType; lightspeed: CellValueType; custom: CellValueType };

const comparisonData: Row[] = [
  { key: 'setup', sellqo: 'setup_sq', shopify: 'setup_sh', lightspeed: 'setup_ls', custom: 'setup_cu' },
  { key: 'monthly', sellqo: 'mo_sq', shopify: 'mo_sh', lightspeed: 'mo_ls', custom: 'mo_cu' },
  { key: 'tx', sellqo: 'tx_sq', shopify: 'N/A', lightspeed: 'N/A', custom: 'N/A' },
  { key: 'health', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { key: 'coach', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { key: 'seo', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { key: 'chatbot', sellqo: true, shopify: 'partial', lightspeed: false, custom: false },
  { key: 'inbox', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { key: 'odoo', sellqo: true, shopify: false, lightspeed: false, custom: 'partial' },
  { key: 'bolAds', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { key: 'metaAds', sellqo: true, shopify: 'partial', lightspeed: false, custom: false },
  { key: 'feed', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { key: 'multi', sellqo: true, shopify: 'partial', lightspeed: 'partial', custom: false },
  { key: 'stock', sellqo: true, shopify: 'partial', lightspeed: true, custom: false },
  { key: 'aiTools', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { key: 'aiDesc', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { key: 'aiTrans', sellqo: true, shopify: false, lightspeed: false, custom: false },
  { key: 'builder', sellqo: true, shopify: true, lightspeed: false, custom: true },
  { key: 'pos', sellqo: true, shopify: true, lightspeed: true, custom: false },
  { key: 'loyalty', sellqo: true, shopify: 'partial', lightspeed: 'partial', custom: false },
  { key: 'giftcards', sellqo: true, shopify: 'partial', lightspeed: 'partial', custom: false },
  { key: 'vat', sellqo: true, shopify: 'partial', lightspeed: 'partial', custom: false },
  { key: 'peppol', sellqo: 'partial', shopify: false, lightspeed: false, custom: 'partial' },
  { key: 'whatsapp', sellqo: true, shopify: 'partial', lightspeed: false, custom: false },
  { key: 'dutchSupport', sellqo: true, shopify: false, lightspeed: true, custom: 'partial' },
  { key: 'freeMigration', sellqo: true, shopify: false, lightspeed: false, custom: false },
];

const platforms = [
  { key: 'sellqo', name: 'SellQo', highlight: true },
  { key: 'shopify', name: 'Shopify', highlight: false },
  { key: 'lightspeed', name: 'Lightspeed', highlight: false },
  { key: 'custom', name: 'Custom', highlight: false },
];

function CellValue({ value }: { value: CellValueType }) {
  const { t } = useTranslation();
  if (value === 'partial') {
    return (
      <div className="flex flex-col items-center">
        <Check className="w-5 h-5 text-amber-500" />
        <span className="text-xs text-amber-600">{t('landing.comparison.viaApp')}</span>
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
  // String value — may be an i18n value key under landing.comparison.values, else literal
  const tryKey = `landing.comparison.values.${value}`;
  const translated = t(tryKey);
  return <span>{translated === tryKey ? value : translated}</span>;
}

export function ComparisonSection() {
  const { ref, isIntersecting } = useIntersectionObserver();
  const { t } = useTranslation();

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
            {t('landing.comparison.heading')}
          </h2>
        </div>

        {/* Scroll hint for mobile */}
        <div className="flex items-center justify-end gap-2 mb-2 md:hidden">
          <span className="text-xs text-muted-foreground">{t('landing.comparison.scrollHint')}</span>
        </div>

        <div
          className={cn(
            'overflow-x-auto -mx-4 px-4',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
          style={{ animationDelay: '0.2s' }}
        >
          <table className="w-full min-w-[640px] bg-card rounded-2xl border border-border shadow-sellqo overflow-hidden">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-left text-foreground font-semibold sticky left-0 bg-card z-10 min-w-[140px]">{t('landing.comparison.featureCol')}</th>
                {platforms.map((platform) => (
                  <th
                    key={platform.key}
                    className={cn(
                      'p-4 text-center font-semibold whitespace-nowrap',
                      platform.highlight ? 'bg-accent/10 text-accent' : 'text-foreground'
                    )}
                  >
                    {platform.name}
                    {platform.highlight && (
                      <span className="block text-xs font-normal mt-1">⭐ {t('landing.comparison.recommended')}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  <td className="p-4 text-foreground sticky left-0 bg-card z-10 text-sm">{t(`landing.comparison.rows.${row.key}`)}</td>
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
            <span className="text-muted-foreground">{t('landing.comparison.legend.included')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-amber-500" />
            <span className="text-muted-foreground">{t('landing.comparison.legend.viaApp')}</span>
          </div>
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 text-red-400" />
            <span className="text-muted-foreground">{t('landing.comparison.legend.notAvailable')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
