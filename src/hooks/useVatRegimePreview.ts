import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RegimeResolution, VatRegimeCode, ProductCategory } from '@/types/accounting';

export interface PreviewLine {
  amount: number;
  product_category?: ProductCategory;
}

interface Args {
  tenantId?: string | null;
  customerId?: string | null;
  lines: PreviewLine[];
  overrideRegime?: VatRegimeCode | null;
  enabled?: boolean;
  debounceMs?: number;
}

interface State {
  loading: boolean;
  error: string | null;
  resolution: RegimeResolution | null;
}

/** Debounced live preview of VAT regime via resolve-vat-regime edge function. */
export function useVatRegimePreview({
  tenantId, customerId, lines, overrideRegime,
  enabled = true, debounceMs = 500,
}: Args): State {
  const [state, setState] = useState<State>({ loading: false, error: null, resolution: null });

  const linesKey = JSON.stringify(
    lines.filter((l) => l.amount > 0).map((l) => ({ a: l.amount, c: l.product_category })),
  );

  useEffect(() => {
    if (!enabled || !tenantId || !customerId) {
      setState({ loading: false, error: null, resolution: null });
      return;
    }
    const validLines = lines.filter((l) => l.amount > 0);
    if (validLines.length === 0) {
      setState({ loading: false, error: null, resolution: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    const handle = window.setTimeout(async () => {
      const { data, error } = await supabase.functions.invoke('resolve-vat-regime', {
        body: {
          tenant_id: tenantId,
          customer_id: customerId,
          invoice_lines: validLines.map((l) => ({
            line_type: 'product' as const,
            amount: l.amount,
            ...(l.product_category ? { product_category: l.product_category } : {}),
          })),
          sales_channel: 'b2b_direct' as const,
          ...(overrideRegime ? { override_regime: overrideRegime } : {}),
        },
      });
      if (cancelled) return;
      if (error) {
        setState({ loading: false, error: error.message || 'Resolver error', resolution: null });
        return;
      }
      setState({ loading: false, error: null, resolution: data as RegimeResolution });
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tenantId, customerId, linesKey, overrideRegime, debounceMs]);

  return state;
}