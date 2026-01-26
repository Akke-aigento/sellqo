import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SyncDataType, SyncStatus } from '@/types/syncRules';

export interface SyncActivityLog {
  id: string;
  tenant_id: string;
  connection_id: string;
  data_type: SyncDataType;
  direction: 'import' | 'export' | 'bidirectional';
  status: SyncStatus;
  records_processed: number;
  records_failed: number;
  error_details: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string;
  created_at: string;
}

export function useSyncHistory(connectionId: string | null, limit = 10) {
  return useQuery({
    queryKey: ['sync-history', connectionId, limit],
    queryFn: async () => {
      if (!connectionId) return [];

      const { data, error } = await supabase
        .from('sync_activity_log')
        .select('*')
        .eq('connection_id', connectionId)
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as SyncActivityLog[];
    },
    enabled: !!connectionId,
  });
}

export function useSyncHistoryByDataType(connectionId: string | null, dataType: SyncDataType) {
  return useQuery({
    queryKey: ['sync-history', connectionId, dataType],
    queryFn: async () => {
      if (!connectionId) return [];

      const { data, error } = await supabase
        .from('sync_activity_log')
        .select('*')
        .eq('connection_id', connectionId)
        .eq('data_type', dataType)
        .order('completed_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as SyncActivityLog[];
    },
    enabled: !!connectionId,
  });
}
