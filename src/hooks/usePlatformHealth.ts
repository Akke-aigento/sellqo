import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';
export type HealthComponent = 'edge_function' | 'sync' | 'api' | 'database' | 'storage' | 'auth' | 'webhook';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'detected' | 'investigating' | 'identified' | 'monitoring' | 'resolved';

export interface HealthMetric {
  id: string;
  metric_name: string;
  component: HealthComponent;
  current_value: number | null;
  threshold_warning: number | null;
  threshold_critical: number | null;
  status: HealthStatus;
  details: Record<string, any>;
  recorded_at: string;
}

export interface PlatformIncident {
  id: string;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affected_tenants: string[];
  affected_components: HealthComponent[];
  root_cause: string | null;
  resolution: string | null;
  detected_at: string;
  identified_at: string | null;
  resolved_at: string | null;
  postmortem_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const COMPONENT_LABELS: Record<HealthComponent, string> = {
  edge_function: 'Edge Functions',
  sync: 'Synchronisatie',
  api: 'API',
  database: 'Database',
  storage: 'Storage',
  auth: 'Authenticatie',
  webhook: 'Webhooks',
};

export const STATUS_COLORS: Record<HealthStatus, string> = {
  healthy: 'text-green-600 bg-green-100',
  warning: 'text-yellow-600 bg-yellow-100',
  critical: 'text-red-600 bg-red-100',
  unknown: 'text-gray-600 bg-gray-100',
};

export const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  low: 'text-blue-600 bg-blue-100',
  medium: 'text-yellow-600 bg-yellow-100',
  high: 'text-orange-600 bg-orange-100',
  critical: 'text-red-600 bg-red-100',
};

export function usePlatformHealth() {
  const queryClient = useQueryClient();

  const { data: metrics = [], isLoading: metricsLoading } = useQuery({
    queryKey: ['platform-health-metrics'],
    queryFn: async () => {
      // Get latest metrics per component
      const { data, error } = await supabase
        .from('platform_health_metrics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as HealthMetric[];
    },
  });

  const { data: incidents = [], isLoading: incidentsLoading } = useQuery({
    queryKey: ['platform-incidents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_incidents')
        .select('*')
        .order('detected_at', { ascending: false });
      if (error) throw error;
      return data as PlatformIncident[];
    },
  });

  const createIncidentMutation = useMutation({
    mutationFn: async (incidentData: Partial<PlatformIncident>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('platform_incidents')
        .insert({
          ...incidentData,
          created_by: userData.user?.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-incidents'] });
      toast.success('Incident aangemaakt');
    },
    onError: (error: Error) => {
      toast.error(`Fout: ${error.message}`);
    },
  });

  const updateIncidentMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlatformIncident> & { id: string }) => {
      const { data, error } = await supabase
        .from('platform_incidents')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-incidents'] });
      toast.success('Incident bijgewerkt');
    },
    onError: (error: Error) => {
      toast.error(`Fout: ${error.message}`);
    },
  });

  const resolveIncident = async (id: string, resolution: string) => {
    return updateIncidentMutation.mutateAsync({
      id,
      status: 'resolved',
      resolution,
      resolved_at: new Date().toISOString(),
    });
  };

  const getOverallStatus = (): HealthStatus => {
    if (metrics.some(m => m.status === 'critical')) return 'critical';
    if (metrics.some(m => m.status === 'warning')) return 'warning';
    if (metrics.length === 0) return 'unknown';
    return 'healthy';
  };

  const getActiveIncidents = () => {
    return incidents.filter(i => i.status !== 'resolved');
  };

  const getStats = () => {
    const activeIncidents = getActiveIncidents().length;
    const criticalIncidents = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;
    const warningMetrics = metrics.filter(m => m.status === 'warning').length;
    const criticalMetrics = metrics.filter(m => m.status === 'critical').length;
    
    return { activeIncidents, criticalIncidents, warningMetrics, criticalMetrics };
  };

  return {
    metrics,
    incidents,
    isLoading: metricsLoading || incidentsLoading,
    createIncident: createIncidentMutation.mutateAsync,
    updateIncident: updateIncidentMutation.mutateAsync,
    resolveIncident,
    getOverallStatus,
    getActiveIncidents,
    getStats,
    isCreating: createIncidentMutation.isPending,
    isUpdating: updateIncidentMutation.isPending,
  };
}
