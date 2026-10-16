// MEDIA-3 + SOCIAL-SEC-1 — heeft deze winkel de externe contentpijplijn, en de twee RPC's.
//
// Knoppen die een verzoek naar de pijplijn sturen ("Maak een post met dit beeld", "Opnieuw
// maken") verschijnen enkel als de winkel een rij met enabled = true heeft in
// social_content_pipeline_tenants. Anders zou de knop een verzoek maken dat niemand oppikt.
// Bestaat de tabel nog niet (migratie niet gedraaid), dan geeft de query een fout en blijft
// het antwoord false: geen dode knop.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { untypedTable } from '@/lib/untypedTable';
import { useTenant } from '@/hooks/useTenant';
import type { SocialContentKind } from '@/lib/socialContent';

interface PipelineRow {
  tenant_id: string;
  enabled: boolean;
}

export interface SocialRpcResult {
  credits_cost: number;
  credits_charged: number;
}

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

const rpc = (fn: string, args: Record<string, unknown>) => (supabase as unknown as RpcClient).rpc(fn, args);

export function useSocialPipeline() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const { data: hasPipeline = false, isLoading } = useQuery({
    queryKey: ['social-pipeline', tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await untypedTable<PipelineRow>('social_content_pipeline_tenants')
        .select('tenant_id, enabled')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) return false;
      return !!data?.enabled;
    },
  });

  return { hasPipeline, isLoading };
}

export function useRequestSocialContent() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      mediaAssetIds: string[];
      kind: SocialContentKind;
      language: string | null;
      wantedFor: string | null;
      note: string;
    }): Promise<SocialRpcResult> => {
      if (!currentTenant?.id) throw new Error('social_no_access');
      const { data, error } = await rpc('request_social_content', {
        p_tenant_id: currentTenant.id,
        p_media_asset_ids: input.mediaAssetIds,
        p_kind: input.kind,
        p_language: input.language,
        p_wanted_for: input.wantedFor,
        p_note: input.note.trim() || null,
      });
      if (error) throw error;
      return data as SocialRpcResult;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-credits'] });
      queryClient.invalidateQueries({ queryKey: ['ai-usage-history'] });
    },
  });
}

/** Wordt door useSocialPlanner gebruikt; apart zodat de RPC-aanroep op één plek staat. */
export async function callRequestSocialRegenerate(postId: string, note: string, language: string | null): Promise<SocialRpcResult> {
  const { data, error } = await rpc('request_social_regenerate', {
    p_post_id: postId,
    p_note: note.trim() || null,
    p_language: language,
  });
  if (error) throw error;
  return data as SocialRpcResult;
}
