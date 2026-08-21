import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';

import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_FORMAT_EMPHASIS } from '@/config/contentMenuCategories';
import type {
  TenantBrandDna,
  TenantBrandDnaInput,
  TenantContentCategory,
  TenantContentCategoryInput,
} from '@/types/content-menu';

/**
 * `tenant_brand_dna` en `tenant_content_categories` staan pas in de
 * gegenereerde `Database`-types nadat de migratie gedraaid is en de types
 * opnieuw gegenereerd zijn. Tot dan kent de getypeerde client die tabelnamen
 * niet.
 *
 * Deze ene cast naar de ongetypeerde clientvorm is het hele vangnet. Bewust
 * geen `as any` per aanroep (zoals `useAIAssistant.ts` doet): dat levert een
 * `no-explicit-any`-fout per regel op. Na het regenereren van de types kan
 * `db` vervangen worden door `supabase` en verdwijnt deze regel.
 */
const db = supabase as unknown as SupabaseClient;

const BRAND_DNA_TABLE = 'tenant_brand_dna';
const CATEGORIES_TABLE = 'tenant_content_categories';

/** Lege staat voor een tenant die nog nooit heeft opgeslagen. */
export const EMPTY_BRAND_DNA: TenantBrandDnaInput = {
  brand_mission: null,
  target_audience: null,
  tone_keywords: [],
  usps: [],
  dos: null,
  donts: null,
  themes: [],
  hashtag_sets: {},
  free_dna: null,
  menu_counts: {},
  format_emphasis: DEFAULT_FORMAT_EMPHASIS,
};

export function useBrandDna() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const tenantId = currentTenant?.id;

  const brandDnaQuery = useQuery({
    queryKey: ['tenant-brand-dna', tenantId],
    queryFn: async (): Promise<TenantBrandDna | null> => {
      if (!tenantId) return null;

      const { data, error } = await db
        .from(BRAND_DNA_TABLE)
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return (data as TenantBrandDna | null) ?? null;
    },
    enabled: !!tenantId,
  });

  const categoriesQuery = useQuery({
    queryKey: ['tenant-content-categories', tenantId],
    queryFn: async (): Promise<TenantContentCategory[]> => {
      if (!tenantId) return [];

      const { data, error } = await db
        .from(CATEGORIES_TABLE)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data as TenantContentCategory[] | null) ?? [];
    },
    enabled: !!tenantId,
  });

  const invalidateBrandDna = () =>
    queryClient.invalidateQueries({ queryKey: ['tenant-brand-dna', tenantId] });
  const invalidateCategories = () =>
    queryClient.invalidateQueries({ queryKey: ['tenant-content-categories', tenantId] });

  const notifySaved = () =>
    toast({ title: t('content_menu.toast.saved') });

  /**
   * De onderliggende fout gaat naar de console, niet naar de toast: die
   * berichten komen onvertaald uit PostgREST en zouden als losse Engelse of
   * Nederlandse brok in een verder vertaald scherm belanden.
   */
  const notifyFailed = (error: unknown) => {
    console.error('[useBrandDna]', error);
    toast({
      title: t('content_menu.toast.save_failed'),
      variant: 'destructive',
    });
  };

  /**
   * Eén upsert op `tenant_id`. De unieke index `ux_tenant_brand_dna_tenant` is
   * het conflictdoel, dus de eerste opslag maakt de rij en elke volgende
   * werkt hem bij.
   */
  const saveBrandDna = useMutation({
    mutationFn: async (input: TenantBrandDnaInput) => {
      if (!tenantId) throw new Error('useBrandDna: missing tenant context');

      const { error } = await db
        .from(BRAND_DNA_TABLE)
        .upsert({ ...input, tenant_id: tenantId }, { onConflict: 'tenant_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateBrandDna();
      notifySaved();
    },
    onError: notifyFailed,
  });

  const createCategory = useMutation({
    mutationFn: async (input: TenantContentCategoryInput) => {
      if (!tenantId) throw new Error('useBrandDna: missing tenant context');

      const { error } = await db
        .from(CATEGORIES_TABLE)
        .insert({ ...input, tenant_id: tenantId });

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCategories();
      notifySaved();
    },
    onError: notifyFailed,
  });

  const updateCategory = useMutation({
    mutationFn: async ({
      id,
      changes,
    }: {
      id: string;
      changes: Partial<TenantContentCategoryInput> & { is_active?: boolean };
    }) => {
      const { error } = await db.from(CATEGORIES_TABLE).update(changes).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCategories();
      notifySaved();
    },
    onError: notifyFailed,
  });

  /**
   * Verbergen in plaats van verwijderen — de zachte weg uit CLAUDE.md §2. De
   * harde variant hieronder zit in de UI achter een expliciete bevestiging.
   */
  const deactivateCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from(CATEGORIES_TABLE)
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCategories();
      invalidateBrandDna();
    },
    onError: notifyFailed,
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(CATEGORIES_TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCategories();
      invalidateBrandDna();
    },
    onError: notifyFailed,
  });

  return {
    brandDna: brandDnaQuery.data ?? null,
    categories: categoriesQuery.data ?? [],
    isLoading: brandDnaQuery.isLoading || categoriesQuery.isLoading,
    isError: brandDnaQuery.isError || categoriesQuery.isError,
    saveBrandDna,
    createCategory,
    updateCategory,
    deactivateCategory,
    deleteCategory,
  };
}
