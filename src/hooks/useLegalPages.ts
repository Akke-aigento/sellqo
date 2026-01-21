import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { LegalPage, LegalPageType, LEGAL_PAGE_TYPES } from "@/types/legal-pages";
import { toast } from "sonner";

export function useLegalPages() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: legalPages = [], isLoading, refetch } = useQuery({
    queryKey: ['legal-pages', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('legal_pages')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('page_type');
      
      if (error) throw error;
      return data as LegalPage[];
    },
    enabled: !!currentTenant?.id,
  });

  const createLegalPageMutation = useMutation({
    mutationFn: async (pageData: Partial<LegalPage> & { page_type: LegalPageType }) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');
      
      const { data, error } = await supabase
        .from('legal_pages')
        .insert({
          ...pageData,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-pages', currentTenant?.id] });
      toast.success('Pagina aangemaakt');
    },
    onError: (error: Error) => {
      toast.error(`Fout bij aanmaken: ${error.message}`);
    },
  });

  const updateLegalPageMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LegalPage> & { id: string }) => {
      const { data, error } = await supabase
        .from('legal_pages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-pages', currentTenant?.id] });
      toast.success('Pagina bijgewerkt');
    },
    onError: (error: Error) => {
      toast.error(`Fout bij bijwerken: ${error.message}`);
    },
  });

  const deleteLegalPageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('legal_pages')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-pages', currentTenant?.id] });
      toast.success('Pagina verwijderd');
    },
    onError: (error: Error) => {
      toast.error(`Fout bij verwijderen: ${error.message}`);
    },
  });

  // Initialize all legal pages for a tenant
  const initializeLegalPages = async () => {
    if (!currentTenant?.id) return;
    
    const existingTypes = legalPages.map(p => p.page_type);
    const missingTypes = LEGAL_PAGE_TYPES.filter(t => !existingTypes.includes(t.type));
    
    if (missingTypes.length === 0) {
      toast.info('Alle pagina\'s zijn al aangemaakt');
      return;
    }
    
    try {
      const pagesToCreate = missingTypes.map(pageInfo => ({
        tenant_id: currentTenant.id,
        page_type: pageInfo.type,
        title_nl: pageInfo.name_nl,
        title_en: pageInfo.name_en,
        is_published: false,
        is_auto_generated: false,
      }));
      
      const { error } = await supabase
        .from('legal_pages')
        .insert(pagesToCreate);
      
      if (error) throw error;
      
      await refetch();
      toast.success(`${missingTypes.length} pagina('s) aangemaakt`);
    } catch (error: any) {
      toast.error(`Fout: ${error.message}`);
    }
  };

  // Get page by type
  const getPageByType = (type: LegalPageType): LegalPage | undefined => {
    return legalPages.find(p => p.page_type === type);
  };

  // Check which pages exist
  const getMissingPages = (): LegalPageType[] => {
    const existingTypes = legalPages.map(p => p.page_type);
    return LEGAL_PAGE_TYPES
      .filter(t => !existingTypes.includes(t.type))
      .map(t => t.type);
  };

  return {
    legalPages,
    isLoading,
    refetch,
    createLegalPage: createLegalPageMutation.mutateAsync,
    updateLegalPage: updateLegalPageMutation.mutateAsync,
    deleteLegalPage: deleteLegalPageMutation.mutateAsync,
    initializeLegalPages,
    getPageByType,
    getMissingPages,
    isCreating: createLegalPageMutation.isPending,
    isUpdating: updateLegalPageMutation.isPending,
  };
}
