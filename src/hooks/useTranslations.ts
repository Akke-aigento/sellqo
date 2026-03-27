import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';
import type {
  ContentTranslation,
  TranslationSettings,
  TranslationJob,
  TranslatableEntityType,
  TranslationLanguage,
  TranslatableField,
  TranslatableEntity,
  ENTITY_TRANSLATABLE_FIELDS,
} from '@/types/translation';

export function useTranslations() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // Fetch translation settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['translation-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from('translation_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as TranslationSettings | null;
    },
    enabled: !!tenantId,
  });

  // Fetch all translations for an entity
  const useEntityTranslations = (entityType: TranslatableEntityType, entityId: string) => {
    return useQuery({
      queryKey: ['translations', tenantId, entityType, entityId],
      queryFn: async () => {
        if (!tenantId) return [];
        
        const { data, error } = await supabase
          .from('content_translations')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('entity_type', entityType)
          .eq('entity_id', entityId);
        
        if (error) throw error;
        return data as ContentTranslation[];
      },
      enabled: !!tenantId && !!entityId,
    });
  };

  // Fetch translation statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['translation-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      // Get counts per entity type
      const { data: products } = await supabase
        .from('products')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId);

      const { data: categories } = await supabase
        .from('categories')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId);

      const { data: translations } = await supabase
        .from('content_translations')
        .select('entity_type, target_language, translated_content')
        .eq('tenant_id', tenantId);

      const productCount = products?.length || 0;
      const categoryCount = categories?.length || 0;
      const translationCount = translations?.filter(t => t.translated_content).length || 0;

      // Calculate coverage per language
      const targetLangs = settings?.target_languages || ['en', 'de', 'fr'];
      const fieldsPerProduct = 5; // name, description, short_description, meta_title, meta_description
      const fieldsPerCategory = 4; // name, description, meta_title, meta_description
      
      const totalNeeded = (productCount * fieldsPerProduct + categoryCount * fieldsPerCategory) * targetLangs.length;

      return {
        products: productCount,
        categories: categoryCount,
        totalTranslations: translationCount,
        totalNeeded,
        coverage: totalNeeded > 0 ? Math.round((translationCount / totalNeeded) * 100) : 100,
        byLanguage: targetLangs.reduce((acc, lang) => {
          const langTranslations = translations?.filter(t => 
            t.target_language === lang && t.translated_content
          ).length || 0;
          const langNeeded = (productCount * fieldsPerProduct + categoryCount * fieldsPerCategory);
          acc[lang] = {
            completed: langTranslations,
            total: langNeeded,
            coverage: langNeeded > 0 ? Math.round((langTranslations / langNeeded) * 100) : 100,
          };
          return acc;
        }, {} as Record<string, { completed: number; total: number; coverage: number }>),
      };
    },
    enabled: !!tenantId,
  });

  // Fetch translation jobs
  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['translation-jobs', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('translation_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as TranslationJob[];
    },
    enabled: !!tenantId,
  });

  // Fetch entities needing translation
  const { data: pendingEntities, isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-translations', tenantId],
    queryFn: async () => {
      if (!tenantId) return { products: [], categories: [] };

      const targetLangs = settings?.target_languages || ['en', 'de', 'fr'];

      // Get products with their translations
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(100);

      const { data: categories } = await supabase
        .from('categories')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(100);

      const { data: translations } = await supabase
        .from('content_translations')
        .select('entity_id, entity_type, target_language, field_name, translated_content')
        .eq('tenant_id', tenantId);

      // Calculate coverage per entity
      const productFields = ['name', 'description', 'short_description', 'meta_title', 'meta_description'];
      const categoryFields = ['name', 'description', 'meta_title', 'meta_description'];

      const productsWithCoverage = (products || []).map(p => {
        const entityTranslations = translations?.filter(t => 
          t.entity_type === 'product' && t.entity_id === p.id
        ) || [];
        const totalNeeded = productFields.length * targetLangs.length;
        const completed = entityTranslations.filter(t => t.translated_content).length;
        return {
          ...p,
          entity_type: 'product' as const,
          coverage: totalNeeded > 0 ? Math.round((completed / totalNeeded) * 100) : 100,
          missing: totalNeeded - completed,
        };
      }).filter(p => p.coverage < 100);

      const categoriesWithCoverage = (categories || []).map(c => {
        const entityTranslations = translations?.filter(t => 
          t.entity_type === 'category' && t.entity_id === c.id
        ) || [];
        const totalNeeded = categoryFields.length * targetLangs.length;
        const completed = entityTranslations.filter(t => t.translated_content).length;
        return {
          ...c,
          entity_type: 'category' as const,
          coverage: totalNeeded > 0 ? Math.round((completed / totalNeeded) * 100) : 100,
          missing: totalNeeded - completed,
        };
      }).filter(c => c.coverage < 100);

      return {
        products: productsWithCoverage,
        categories: categoriesWithCoverage,
      };
    },
    enabled: !!tenantId && !!settings,
  });

  // Save translation settings
  const saveSettings = useMutation({
    mutationFn: async (newSettings: Partial<TranslationSettings>) => {
      if (!tenantId) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('translation_settings')
        .upsert({
          tenant_id: tenantId,
          ...newSettings,
        }, { onConflict: 'tenant_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['translation-settings'] });
      toast.success('Vertaalinstellingen opgeslagen');
    },
    onError: (error) => {
      toast.error('Fout bij opslaan instellingen', { description: error.message });
    },
  });

  // Save single translation
  const saveTranslation = useMutation({
    mutationFn: async (params: {
      entityType: TranslatableEntityType;
      entityId: string;
      fieldName: TranslatableField;
      targetLanguage: TranslationLanguage;
      translatedContent: string;
      sourceContent?: string;
      isAutoTranslated?: boolean;
    }) => {
      if (!tenantId) throw new Error('No tenant');

      const { data: session } = await supabase.auth.getSession();

      const { data, error } = await supabase
        .from('content_translations')
        .upsert({
          tenant_id: tenantId,
          entity_type: params.entityType,
          entity_id: params.entityId,
          field_name: params.fieldName,
          target_language: params.targetLanguage,
          translated_content: params.translatedContent,
          source_content: params.sourceContent,
          source_language: settings?.source_language || 'nl',
          is_auto_translated: params.isAutoTranslated ?? false,
          translated_at: new Date().toISOString(),
          translated_by: session?.session?.user?.id,
        }, { 
          onConflict: 'tenant_id,entity_type,entity_id,field_name,target_language' 
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['translations', tenantId, variables.entityType, variables.entityId] 
      });
      queryClient.invalidateQueries({ queryKey: ['translation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-translations'] });
    },
    onError: (error) => {
      toast.error('Fout bij opslaan vertaling', { description: error.message });
    },
  });

  // Toggle translation lock
  const toggleLock = useMutation({
    mutationFn: async (translationId: string) => {
      const { data: current } = await supabase
        .from('content_translations')
        .select('is_locked')
        .eq('id', translationId)
        .single();

      const { error } = await supabase
        .from('content_translations')
        .update({ is_locked: !current?.is_locked })
        .eq('id', translationId);

      if (error) throw error;
      return !current?.is_locked;
    },
    onSuccess: (isLocked) => {
      queryClient.invalidateQueries({ queryKey: ['translations'] });
      toast.success(isLocked ? 'Vertaling vergrendeld' : 'Vertaling ontgrendeld');
    },
  });

  // Start bulk translation job
  const startBulkTranslation = useMutation({
    mutationFn: async (params: {
      entityTypes: TranslatableEntityType[];
      targetLanguages: TranslationLanguage[];
      mode: 'all' | 'missing' | 'outdated';
    }) => {
      if (!tenantId) throw new Error('No tenant');

      const response = await supabase.functions.invoke('ai-translate-content', {
        body: {
          tenantId,
          entityTypes: params.entityTypes,
          targetLanguages: params.targetLanguages,
          mode: params.mode,
        },
      });

      // Parse credit-related errors from the response
      if (response.error) {
        // Try to extract structured error data from the response
        const errorData = response.data;
        if (errorData?.creditsNeeded && errorData?.creditsAvailable) {
          const err = new Error(`Onvoldoende credits: ${errorData.creditsNeeded} nodig, ${errorData.creditsAvailable} beschikbaar`) as Error & { creditsNeeded?: number; creditsAvailable?: number };
          err.creditsNeeded = errorData.creditsNeeded;
          err.creditsAvailable = errorData.creditsAvailable;
          throw err;
        }
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['translation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['translation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-translations'] });
      toast.success(`Vertaling voltooid: ${data.itemsQueued} items`, {
        description: `${data.translationsCreated} vertalingen gemaakt — ${data.creditsUsed} credits gebruikt`,
      });
    },
    onError: (error: Error & { creditsNeeded?: number; creditsAvailable?: number }) => {
      if (error.creditsNeeded) {
        toast.error('Onvoldoende AI credits', {
          description: `Je hebt ${error.creditsNeeded} credits nodig maar slechts ${error.creditsAvailable} beschikbaar. Koop extra credits via Marketing → AI Credits.`,
          duration: 8000,
        });
      } else {
        toast.error('Fout bij starten vertaling', { description: error.message });
      }
    },
  });

  // Translate single entity
  const translateEntity = useMutation({
    mutationFn: async (params: {
      entityType: TranslatableEntityType;
      entityId: string;
      targetLanguages: TranslationLanguage[];
    }) => {
      if (!tenantId) throw new Error('No tenant');

      const response = await supabase.functions.invoke('ai-translate-content', {
        body: {
          tenantId,
          entityType: params.entityType,
          entityId: params.entityId,
          targetLanguages: params.targetLanguages,
        },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['translations', tenantId, variables.entityType, variables.entityId] 
      });
      queryClient.invalidateQueries({ queryKey: ['translation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-translations'] });
      toast.success('Vertaling voltooid', {
        description: `${data.translationsCreated} vertalingen gemaakt`,
      });
    },
    onError: (error) => {
      toast.error('Fout bij vertalen', { description: error.message });
    },
  });

  return {
    settings,
    settingsLoading,
    stats,
    statsLoading,
    jobs,
    jobsLoading,
    pendingEntities,
    pendingLoading,
    saveSettings,
    saveTranslation,
    toggleLock,
    startBulkTranslation,
    translateEntity,
    useEntityTranslations,
  };
}
