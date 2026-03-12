import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StorefrontShippingMethod {
  id: string;
  name: string;
  description: string | null;
  price: number;
  free_above: number | null;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  is_default: boolean;
}

export function useStorefrontShipping(tenantId: string | undefined) {
  const [methods, setMethods] = useState<StorefrontShippingMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);

    supabase.functions.invoke('storefront-api', {
      body: { action: 'get_shipping_methods', tenant_id: tenantId },
    }).then(({ data, error }) => {
      if (!error && data?.data) {
        const list = data.data as StorefrontShippingMethod[];
        setMethods(list);
        const def = list.find(m => m.is_default) || list[0];
        if (def) setSelectedMethodId(def.id);
      }
    }).finally(() => setLoading(false));
  }, [tenantId]);

  const selectedMethod = useMemo(
    () => methods.find(m => m.id === selectedMethodId) || null,
    [methods, selectedMethodId],
  );

  const getShippingCost = useMemo(() => {
    return (subtotal: number) => {
      if (!selectedMethod) return 0;
      if (subtotal <= 0) return 0;
      if (selectedMethod.free_above && subtotal >= selectedMethod.free_above) return 0;
      return selectedMethod.price;
    };
  }, [selectedMethod]);

  return {
    methods,
    selectedMethod,
    selectedMethodId,
    setSelectedMethodId,
    getShippingCost,
    loading,
  };
}
