import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PrintfulVariantMapping {
  id: string;
  tenant_id: string;
  variant_id: string;
  printful_sync_variant_id: number;
  printful_sync_product_id: number | null;
  printful_variant_name: string | null;
  is_active: boolean;
}

export interface PrintfulSyncProduct {
  sync_product_id: number;
  name: string;
  thumbnail?: string;
  variants: Array<{ sync_variant_id: number; name: string; sku?: string }>;
}

export interface TenantVariantRow {
  id: string;
  title: string;
  sku: string | null;
  product_name: string;
}

export function usePrintfulSyncProducts(tenantId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['printful-sync-products', tenantId],
    enabled: !!tenantId && enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PrintfulSyncProduct[]> => {
      const { data, error } = await supabase.functions.invoke('list-printful-sync-products', {
        body: { tenantId },
      });
      if (error) throw new Error(error.message);
      const payload = data as { success?: boolean; error?: string; products?: PrintfulSyncProduct[] };
      if (!payload?.success) throw new Error(payload?.error || 'Printful-producten ophalen mislukt');
      return payload.products ?? [];
    },
  });
}

export function useTenantVariants(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['printful-tenant-variants', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<TenantVariantRow[]> => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, title, sku, products!inner(name)')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .order('title')
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((v) => {
        const rel = (v as unknown as { products?: { name?: string } | Array<{ name?: string }> }).products;
        const productName = Array.isArray(rel) ? rel[0]?.name : rel?.name;
        return {
          id: v.id as string,
          title: (v.title as string) ?? '',
          sku: (v.sku as string | null) ?? null,
          product_name: productName ?? '—',
        };
      });
    },
  });
}

export function usePrintfulVariantMappings(tenantId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['printful-variant-mappings', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<PrintfulVariantMapping[]> => {
      const { data, error } = await supabase
        .from('printful_variant_mappings')
        .select('*')
        .eq('tenant_id', tenantId!);
      if (error) throw error;
      return (data ?? []) as unknown as PrintfulVariantMapping[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['printful-variant-mappings', tenantId] });

  const upsert = useMutation({
    mutationFn: async (payload: {
      variant_id: string;
      printful_sync_variant_id: number;
      printful_sync_product_id?: number | null;
      printful_variant_name?: string | null;
    }) => {
      if (!tenantId) throw new Error('tenant_id required');
      const { data, error } = await supabase
        .from('printful_variant_mappings')
        .upsert({
          tenant_id: tenantId,
          variant_id: payload.variant_id,
          printful_sync_variant_id: payload.printful_sync_variant_id,
          printful_sync_product_id: payload.printful_sync_product_id ?? null,
          printful_variant_name: payload.printful_variant_name ?? null,
          is_active: true,
        }, { onConflict: 'tenant_id,variant_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast.success('Variant gekoppeld'); },
    onError: (err: Error) => toast.error(err.message || 'Koppelen mislukt'),
  });

  const remove = useMutation({
    mutationFn: async (variantId: string) => {
      if (!tenantId) throw new Error('tenant_id required');
      const { error } = await supabase
        .from('printful_variant_mappings')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('variant_id', variantId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Koppeling verwijderd'); },
    onError: (err: Error) => toast.error(err.message || 'Verwijderen mislukt'),
  });

  return { mappings: query.data ?? [], isLoading: query.isLoading, upsert, remove };
}
