import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import type {
  MenuCard,
  MenuCardMetadata,
  DailyMenuErrorCode,
  DailyMenuResult,
} from '@/types/daily-menu';

/** Aantal kaarten dat we maximaal ophalen — ruim boven MAX_SLOTS (20). */
const HISTORY_LIMIT = 60;

/**
 * Haalt de foutcode uit een edge-functie-antwoord. `functions.invoke` verpakt
 * een non-2xx-respons in een FunctionsHttpError waarvan de body pas via
 * `context.json()` beschikbaar is; zonder dit kregen we alleen "Edge Function
 * returned a non-2xx status code" en konden we geen gerichte melding tonen.
 */
async function readErrorCode(error: unknown): Promise<DailyMenuErrorCode | null> {
  const context = (error as { context?: Response })?.context;
  if (!context || typeof context.json !== 'function') return null;
  try {
    const body = await context.json();
    return (body?.code as DailyMenuErrorCode) ?? null;
  } catch {
    return null;
  }
}

export function useDailyMenu() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const tenantId = currentTenant?.id;

  const cardsQuery = useQuery({
    queryKey: ['daily-menu-cards', tenantId],
    queryFn: async (): Promise<MenuCard[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('content_type', 'menu_card')
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT);

      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        platform: row.platform,
        title: row.title,
        content_text: row.content_text,
        image_urls: row.image_urls ?? [],
        product_ids: row.product_ids ?? [],
        language: row.language,
        is_used: row.is_used,
        created_at: row.created_at,
        metadata: (row.metadata ?? {}) as unknown as MenuCardMetadata,
      }));
    },
    enabled: !!tenantId,
  });

  /**
   * Alleen de kaarten van de laatste ronde. De query staat op nieuwste-eerst,
   * dus de `menu_run_id` van de eerste rij is de meest recente ronde.
   *
   * De `?? []`-fallback staat binnen de useMemo en niet erbuiten: buiten zou
   * hij bij elke render een nieuwe array opleveren en de memo dus nutteloos
   * maken.
   */
  const latestRun = useMemo(() => {
    const allCards = cardsQuery.data ?? [];
    const runId = allCards[0]?.metadata?.menu_run_id;
    if (!runId) return { runId: null as string | null, cards: [] as MenuCard[] };
    const cards = allCards
      .filter((c) => c.metadata?.menu_run_id === runId && !c.metadata?.discarded_at)
      .sort((a, b) => (a.metadata?.card_index ?? 0) - (b.metadata?.card_index ?? 0));
    return { runId, cards };
  }, [cardsQuery.data]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['daily-menu-cards', tenantId] });

  const generate = useMutation({
    mutationFn: async (): Promise<DailyMenuResult> => {
      if (!tenantId) throw new Error('useDailyMenu: missing tenant context');

      const { data, error } = await supabase.functions.invoke('ai-generate-daily-menu', {
        body: { tenantId, language: 'nl' },
      });

      if (error) {
        const code = await readErrorCode(error);
        if (code) throw Object.assign(new Error(code), { code });
        throw error;
      }
      return data as DailyMenuResult;
    },
    onSuccess: (result) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['ai-credits', tenantId] });
      toast({
        title: t('content_menu.today.toast.generated', { amount: result.generated }),
        description:
          result.skipped > 0
            ? t('content_menu.today.toast.skipped', { amount: result.skipped })
            : undefined,
      });
    },
    onError: (error: Error & { code?: DailyMenuErrorCode }) => {
      // brand_dna_missing en menu_empty krijgen een eigen staat in het scherm;
      // die hoeven geen toast bovenop.
      if (error.code === 'brand_dna_missing' || error.code === 'menu_empty') return;

      console.error('[useDailyMenu]', error);
      const key =
        error.code === 'insufficient_credits'
          ? 'content_menu.today.errors.insufficient_credits'
          : error.code === 'rate_limit'
            ? 'content_menu.today.errors.rate_limit'
            : 'content_menu.today.errors.generate_failed';
      toast({ title: t(key), variant: 'destructive' });
    },
  });

  /** Werkt de metadata van één kaart bij zonder de rest te verliezen. */
  const patchMetadata = async (card: MenuCard, patch: Partial<MenuCardMetadata>) => {
    const { error } = await supabase
      .from('ai_generated_content')
      .update({ metadata: { ...card.metadata, ...patch } as unknown as Json })
      .eq('id', card.id);
    if (error) throw error;
  };

  const updateCard = useMutation({
    mutationFn: async ({
      card,
      title,
      caption,
      hashtags,
    }: {
      card: MenuCard;
      title: string;
      caption: string;
      hashtags: string[];
    }) => {
      const { error } = await supabase
        .from('ai_generated_content')
        .update({
          title,
          content_text: caption,
          metadata: { ...card.metadata, hashtags } as unknown as Json,
        })
        .eq('id', card.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: t('content_menu.today.toast.updated') });
    },
    onError: (error) => {
      console.error('[useDailyMenu]', error);
      toast({ title: t('content_menu.today.errors.save_failed'), variant: 'destructive' });
    },
  });

  /**
   * Weggooien is verbergen, niet verwijderen (CLAUDE.md §2). De rij blijft in
   * `ai_generated_content` staan met een `discarded_at`, zodat de historie en
   * de engagement-view kloppen.
   */
  const discardCard = useMutation({
    mutationFn: async (card: MenuCard) => {
      await patchMetadata(card, { discarded_at: new Date().toISOString() });
    },
    onSuccess: () => {
      invalidate();
      toast({ title: t('content_menu.today.toast.discarded') });
    },
    onError: (error) => {
      console.error('[useDailyMenu]', error);
      toast({ title: t('content_menu.today.errors.save_failed'), variant: 'destructive' });
    },
  });

  /** Koppelt een gegenereerd beeld aan de kaart. */
  const attachImage = useMutation({
    mutationFn: async ({ card, imageUrl }: { card: MenuCard; imageUrl: string }) => {
      const { error } = await supabase
        .from('ai_generated_content')
        .update({
          image_urls: [...(card.image_urls ?? []), imageUrl],
          metadata: { ...card.metadata, image_url: imageUrl } as unknown as Json,
        })
        .eq('id', card.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (error) => {
      console.error('[useDailyMenu]', error);
      toast({ title: t('content_menu.today.errors.save_failed'), variant: 'destructive' });
    },
  });

  /** Markeert de kaart als gebruikt nadat hij als concept is klaargezet. */
  const markUsed = useMutation({
    mutationFn: async (card: MenuCard) => {
      const { error } = await supabase
        .from('ai_generated_content')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('id', card.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  return {
    cards: latestRun.cards,
    menuRunId: latestRun.runId,
    isLoading: cardsQuery.isLoading,
    isError: cardsQuery.isError,
    generate,
    updateCard,
    discardCard,
    attachImage,
    markUsed,
  };
}
