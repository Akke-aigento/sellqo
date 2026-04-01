import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Badge } from '@/components/ui/badge';

export function AdsAiBadge() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const { data: count = 0 } = useQuery({
    queryKey: ['ads-ai-pending-count', tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const { count, error } = await supabase
        .from('ads_ai_recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending');
      if (error) return 0;
      return count || 0;
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });

  if (count === 0) return null;

  return (
    <Badge variant="destructive" className="ml-auto h-5 min-w-[20px] px-1.5 text-[10px] font-bold">
      {count > 99 ? '99+' : count}
    </Badge>
  );
}
