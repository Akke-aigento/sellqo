import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useProductSpecifications } from '@/hooks/useProductSpecifications';
import { useChannelFieldMappings } from '@/hooks/useChannelFieldMappings';
import { cn } from '@/lib/utils';

interface ProductChannelWarningsProps {
  productId: string;
  barcode?: string | null;
  className?: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  bol_com: 'Bol.com',
  amazon: 'Amazon',
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  ebay: 'eBay',
};

export function ProductChannelWarnings({ productId, barcode, className }: ProductChannelWarningsProps) {
  const { specification, customSpecs, isLoading: specsLoading } = useProductSpecifications(productId);
  const { mappings, isLoading: mappingsLoading } = useChannelFieldMappings();

  const warnings = useMemo(() => {
    if (!mappings.length) return [];

    // Group required mappings by channel
    const channelRequired = mappings
      .filter(m => m.is_required)
      .reduce<Record<string, typeof mappings>>((acc, m) => {
        if (!acc[m.channel_type]) acc[m.channel_type] = [];
        acc[m.channel_type].push(m);
        return acc;
      }, {});

    const results: Array<{ channel: string; label: string; missing: string[]; ok: boolean }> = [];

    for (const [channel, required] of Object.entries(channelRequired)) {
      const missing: string[] = [];

      for (const mapping of required) {
        const field = mapping.sellqo_field;
        let hasValue = false;

        if (field.startsWith('specs.')) {
          const key = field.replace('specs.', '');
          if (key === 'barcode' || key === 'ean') {
            hasValue = !!barcode;
          } else {
            hasValue = !!(specification as any)?.[key];
          }
        } else if (field.startsWith('custom.')) {
          const key = field.replace('custom.', '');
          hasValue = customSpecs.some(s => s.spec_key === key && s.spec_value);
        }

        if (!hasValue) {
          missing.push(mapping.channel_field_label);
        }
      }

      results.push({
        channel,
        label: CHANNEL_LABELS[channel] || channel,
        missing,
        ok: missing.length === 0,
      });
    }

    return results;
  }, [mappings, specification, customSpecs, barcode]);

  if (specsLoading || mappingsLoading || warnings.length === 0) return null;

  return (
    <div className={cn('space-y-1.5', className)}>
      {warnings.map(w => (
        <div key={w.channel} className={cn(
          'flex items-start gap-2 text-sm rounded-md px-3 py-2',
          w.ok ? 'bg-muted/50 text-foreground' : 'bg-destructive/10 text-destructive'
        )}>
          {w.ok ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          )}
          <span>
            <strong>{w.label}:</strong>{' '}
            {w.ok ? 'Alle verplichte velden ingevuld' : `${w.missing.join(', ')} ontbreekt`}
          </span>
        </div>
      ))}
    </div>
  );
}
