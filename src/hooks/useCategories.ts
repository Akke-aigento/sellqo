import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import type { Category, CategoryFormData } from '@/types/product';

export function useCategories() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ['categories', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Category[];
    },
    enabled: !!currentTenant,
  });

  const createCategory = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      if (!currentTenant) throw new Error('No tenant selected');

      const { data: category, error } = await supabase
        .from('categories')
        .insert({
          ...data,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();

      if (error) throw error;
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', currentTenant?.id] });
      toast({ title: 'Categorie aangemaakt', description: 'De categorie is succesvol toegevoegd.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CategoryFormData> }) => {
      const { data: category, error } = await supabase
        .from('categories')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', currentTenant?.id] });
      toast({ title: 'Categorie bijgewerkt', description: 'De wijzigingen zijn opgeslagen.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', currentTenant?.id] });
      toast({ title: 'Categorie verwijderd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const updateSortOrder = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from('categories')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', currentTenant?.id] });
      toast({ title: 'Volgorde bijgewerkt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const reparentCategory = useMutation({
    mutationFn: async ({ id, newParentId }: { id: string; newParentId: string | null }) => {
      // Get the max sort_order in the new parent's children
      const siblings = categoriesQuery.data?.filter(c => c.parent_id === newParentId) || [];
      const maxSortOrder = Math.max(-1, ...siblings.map(c => c.sort_order ?? 0));

      const { error } = await supabase
        .from('categories')
        .update({ 
          parent_id: newParentId,
          sort_order: maxSortOrder + 1,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', currentTenant?.id] });
      toast({ title: 'Categorie verplaatst' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  // Build tree structure from flat list
  const buildCategoryTree = (categories: Category[]): Category[] => {
    const map = new Map<string, Category>();
    const roots: Category[] = [];

    // First pass: create map
    categories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree
    categories.forEach(cat => {
      const node = map.get(cat.id)!;
      if (cat.parent_id && map.has(cat.parent_id)) {
        const parent = map.get(cat.parent_id)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort children by sort_order
    const sortChildren = (cats: Category[]): Category[] => {
      return cats
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(cat => ({
          ...cat,
          children: cat.children ? sortChildren(cat.children) : [],
        }));
    };

    return sortChildren(roots);
  };

  return {
    categories: categoriesQuery.data || [],
    categoryTree: buildCategoryTree(categoriesQuery.data || []),
    isLoading: categoriesQuery.isLoading,
    error: categoriesQuery.error,
    createCategory,
    updateCategory,
    deleteCategory,
    updateSortOrder,
    reparentCategory,
    refetch: categoriesQuery.refetch,
  };
}
