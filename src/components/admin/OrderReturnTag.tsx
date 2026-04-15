import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string;
  showLink?: boolean;
}

const TAG_CONFIG: Record<string, { label: string; className: string }> = {
  retour_lopend: { label: 'Retour lopend', className: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30' },
  retour_wacht_op_refund: { label: 'Wacht op refund', className: 'bg-orange-500/10 text-orange-700 border-orange-500/30' },
  retour_ok: { label: 'Retour OK', className: 'bg-green-500/10 text-green-700 border-green-500/30' },
  retour_deels_lopend: { label: 'Retour deels', className: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30' },
  retour_afgewezen: { label: 'Retour afgewezen', className: 'bg-red-500/10 text-red-700 border-red-500/30' },
};

export function OrderReturnTag({ orderId, showLink = true }: Props) {
  const { data: tag } = useQuery({
    queryKey: ['order-return-tag', orderId],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_order_return_tag', { _order_id: orderId });
      return data as string | null;
    },
  });

  const { data: returns } = useQuery({
    queryKey: ['order-returns-links', orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from('returns')
        .select('id, rma_number')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!tag && showLink,
  });

  if (!tag) return null;
  const config = TAG_CONFIG[tag];
  if (!config) return null;

  const badge = (
    <Badge variant="outline" className={cn('text-xs', config.className)}>
      {config.label}
    </Badge>
  );

  if (!showLink || !returns || returns.length === 0) return badge;

  if (returns.length === 1) {
    return <Link to={`/admin/returns/${returns[0].id}`}>{badge}</Link>;
  }

  return (
    <div className="flex flex-col gap-1">
      {returns.map((r) => (
        <Link key={r.id} to={`/admin/returns/${r.id}`}>
          <Badge variant="outline" className={cn('text-xs', config.className)}>
            {r.rma_number || config.label}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
