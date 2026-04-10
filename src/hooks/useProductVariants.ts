import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface ProductVariant {
  id: string;
  product_id: string;
  tenant_id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  compare_at_price: number | null;
  cost_price: number | null;
  stock: number;
  track_inventory: boolean;
  is_active: boolean;
  image_url: string | null;
  attribute_values: Record<string, string>;
  weight: number | null;
  position: number;
  linked_product_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariantOption {
  id: string;
  product_id: string;
  tenant_id: string;
  name: string;
  values: string[];
  position: number;
  created_at: string;
  updated_at: string;
}

export interface VariantFormData {
  title: string;
  sku?: string | null;
  barcode?: string | null;
  price?: number | null;
  compare_at_price?: number | null;
  cost_price?: number | null;
  stock?: number;
  track_inventory?: boolean;
  is_active?: boolean;
  image_url?: string | null;
  attribute_values?: Record<string, string>;
  weight?: number | null;
  position?: number;
  linked_product_id?: string | null;
}

export interface VariantOptionFormData {
  name: string;
  values: string[];
  position?: number;
}

export function useProductVariants(productId: string | undefined) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const variantsQuery = useQuery({
    queryKey: ['product-variants', productId],
    queryFn: async () => {
      if (!productId || !currentTenant) return [];
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .eq('tenant_id', currentTenant.id)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []).map(v => ({
        ...v,
        attribute_values: (v.attribute_values as Record<string, string>) || {},
      })) as ProductVariant[];
    },
    enabled: !!productId && !!currentTenant,
  });

  const optionsQuery = useQuery({
    queryKey: ['product-variant-options', productId],
    queryFn: async () => {
      if (!productId || !currentTenant) return [];
      const { data, error } = await supabase
        .from('product_variant_options')
        .select('*')
        .eq('product_id', productId)
        .eq('tenant_id', currentTenant.id)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as ProductVariantOption[];
    },
    enabled: !!productId && !!currentTenant,
  });

  const createVariant = useMutation({
    mutationFn: async (data: VariantFormData) => {
      if (!productId || !currentTenant) throw new Error('Missing product or tenant');
      const { data: variant, error } = await supabase
        .from('product_variants')
        .insert({
          ...data,
          attribute_values: (data.attribute_values || {}) as unknown as Json,
          product_id: productId,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();
      if (error) throw error;
      return variant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] });
      toast({ title: 'Variant aangemaakt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const updateVariant = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<VariantFormData> }) => {
      const updateData: Record<string, unknown> = { ...data };
      if (data.attribute_values) {
        updateData.attribute_values = data.attribute_values as unknown as Json;
      }
      const { data: variant, error } = await supabase
        .from('product_variants')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return variant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] });
      toast({ title: 'Variant bijgewerkt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const deleteVariant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] });
      toast({ title: 'Variant verwijderd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  // Options CRUD
  const createOption = useMutation({
    mutationFn: async (data: VariantOptionFormData) => {
      if (!productId || !currentTenant) throw new Error('Missing product or tenant');
      const { data: option, error } = await supabase
        .from('product_variant_options')
        .insert({
          ...data,
          product_id: productId,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();
      if (error) throw error;
      return option;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variant-options', productId] });
      toast({ title: 'Optie aangemaakt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const updateOption = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<VariantOptionFormData> }) => {
      const { data: option, error } = await supabase
        .from('product_variant_options')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return option;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variant-options', productId] });
      toast({ title: 'Optie bijgewerkt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_variant_options')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variant-options', productId] });
      toast({ title: 'Optie verwijderd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  // Sync variants: remove stale, add missing combinations
  const syncVariants = useMutation({
    mutationFn: async (updatedOptions?: ProductVariantOption[]) => {
      if (!productId || !currentTenant) throw new Error('Missing product or tenant');
      const currentOptions = updatedOptions || optionsQuery.data || [];
      if (currentOptions.length === 0) return { removed: 0, added: 0 };

      // Build valid values map per option name
      const validValuesMap = new Map<string, Set<string>>();
      for (const opt of currentOptions) {
        validValuesMap.set(opt.name, new Set(opt.values));
      }

      // Find stale variants (attribute values no longer in options)
      const existing = variantsQuery.data || [];
      const stale = existing.filter(v => {
        const attrs = v.attribute_values || {};
        return Object.entries(attrs).some(([key, val]) => {
          const validSet = validValuesMap.get(key);
          return !validSet || !validSet.has(val);
        });
      });

      // Delete stale
      if (stale.length > 0) {
        const { error } = await supabase
          .from('product_variants')
          .delete()
          .in('id', stale.map(s => s.id));
        if (error) throw error;
      }

      // Generate cartesian product of current option values
      const combinations = currentOptions.reduce<Record<string, string>[]>(
        (acc, option) => {
          if (acc.length === 0) {
            return option.values.map(v => ({ [option.name]: v }));
          }
          return acc.flatMap(combo =>
            option.values.map(v => ({ ...combo, [option.name]: v }))
          );
        },
        []
      );

      // Filter out still-existing valid variants
      const kept = existing.filter(v => !stale.includes(v));
      const newCombinations = combinations.filter(combo => {
        return !kept.some(ev => {
          const attrs = ev.attribute_values || {};
          return Object.keys(combo).every(k => attrs[k] === combo[k]) &&
            Object.keys(attrs).length === Object.keys(combo).length;
        });
      });

      // Insert new
      if (newCombinations.length > 0) {
        const inserts = newCombinations.map((combo, idx) => ({
          product_id: productId,
          tenant_id: currentTenant.id,
          title: Object.values(combo).join(' / '),
          attribute_values: combo as unknown as Json,
          position: kept.length + idx,
        }));
        const { error } = await supabase
          .from('product_variants')
          .insert(inserts);
        if (error) throw error;
      }

      return { removed: stale.length, added: newCombinations.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] });
      const parts: string[] = [];
      if (result.removed > 0) parts.push(`${result.removed} verouderde verwijderd`);
      if (result.added > 0) parts.push(`${result.added} nieuwe aangemaakt`);
      if (parts.length > 0) {
        toast({ title: `Varianten gesynchroniseerd`, description: parts.join(', ') });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij synchroniseren', description: error.message, variant: 'destructive' });
    },
  });

  // Generate all variant combinations from options
  const generateVariants = useMutation({
    mutationFn: async () => {
      if (!productId || !currentTenant) throw new Error('Missing product or tenant');
      const options = optionsQuery.data || [];
      if (options.length === 0) throw new Error('Voeg eerst opties toe');

      // Generate cartesian product of option values
      const combinations = options.reduce<Record<string, string>[]>(
        (acc, option) => {
          if (acc.length === 0) {
            return option.values.map(v => ({ [option.name]: v }));
          }
          return acc.flatMap(combo =>
            option.values.map(v => ({ ...combo, [option.name]: v }))
          );
        },
        []
      );

      // Filter out already existing combinations
      const existing = variantsQuery.data || [];
      const newCombinations = combinations.filter(combo => {
        return !existing.some(ev => {
          const attrs = ev.attribute_values || {};
          return Object.keys(combo).every(k => attrs[k] === combo[k]) &&
            Object.keys(attrs).length === Object.keys(combo).length;
        });
      });

      if (newCombinations.length === 0) {
        throw new Error('Alle combinaties bestaan al');
      }

      const inserts = newCombinations.map((combo, idx) => ({
        product_id: productId,
        tenant_id: currentTenant.id,
        title: Object.values(combo).join(' / '),
        attribute_values: combo as unknown as Json,
        position: existing.length + idx,
      }));

      const { error } = await supabase
        .from('product_variants')
        .insert(inserts);
      if (error) throw error;
      return newCombinations.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] });
      toast({ title: `${count} varianten aangemaakt` });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  return {
    variants: variantsQuery.data || [],
    options: optionsQuery.data || [],
    isLoading: variantsQuery.isLoading || optionsQuery.isLoading,
    createVariant,
    updateVariant,
    deleteVariant,
    createOption,
    updateOption,
    deleteOption,
    generateVariants,
    syncVariants,
    refetch: () => {
      variantsQuery.refetch();
      optionsQuery.refetch();
    },
  };
}
