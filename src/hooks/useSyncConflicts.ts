import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import type { SyncDataType } from '@/types/syncRules';

export interface SyncConflict {
  id: string;
  tenant_id: string;
  connection_id: string;
  data_type: SyncDataType;
  record_id: string;
  sellqo_data: Record<string, unknown>;
  platform_data: Record<string, unknown>;
  conflict_fields: string[];
  detected_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution: 'sellqo' | 'platform' | 'merged' | 'dismissed' | null;
  resolution_data: Record<string, unknown> | null;
  created_at: string;
}

export function useSyncConflicts(connectionId?: string | null) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: conflicts, isLoading, error, refetch } = useQuery({
    queryKey: ['sync-conflicts', currentTenant?.id, connectionId],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('sync_conflicts')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .is('resolved_at', null)
        .order('detected_at', { ascending: false });

      if (connectionId) {
        query = query.eq('connection_id', connectionId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SyncConflict[];
    },
    enabled: !!currentTenant?.id,
  });

  const resolveConflict = useMutation({
    mutationFn: async (params: {
      conflictId: string;
      resolution: 'sellqo' | 'platform' | 'merged' | 'dismissed';
      resolutionData?: Record<string, unknown>;
    }) => {
      const { error } = await supabase.rpc('resolve_sync_conflict' as any, {
        p_conflict_id: params.conflictId,
        p_resolution: params.resolution,
        p_resolution_data: params.resolutionData || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-conflicts'] });
      toast.success('Conflict opgelost');
    },
    onError: (error) => {
      toast.error('Kon conflict niet oplossen: ' + error.message);
    },
  });

  const resolveMultiple = useMutation({
    mutationFn: async (params: {
      conflictIds: string[];
      resolution: 'sellqo' | 'platform' | 'dismissed';
    }) => {
      for (const conflictId of params.conflictIds) {
        const { error } = await supabase.rpc('resolve_sync_conflict' as any, {
          p_conflict_id: conflictId,
          p_resolution: params.resolution,
          p_resolution_data: null,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sync-conflicts'] });
      toast.success(`${variables.conflictIds.length} conflicten opgelost`);
    },
    onError: (error) => {
      toast.error('Kon conflicten niet oplossen: ' + error.message);
    },
  });

  const unresolvedCount = conflicts?.length || 0;

  return {
    conflicts: conflicts ?? [],
    unresolvedCount,
    isLoading,
    error,
    refetch,
    resolveConflict,
    resolveMultiple,
  };
}

export function useAllSyncConflicts() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['all-sync-conflicts', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('sync_conflicts')
        .select(`
          *,
          marketplace_connections(marketplace_type, marketplace_name)
        `)
        .eq('tenant_id', currentTenant.id)
        .is('resolved_at', null)
        .order('detected_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });
}
