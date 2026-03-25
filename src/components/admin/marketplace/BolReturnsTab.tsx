import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { RefreshCw, RotateCcw, Package, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

interface BolReturnsTabProps {
  connectionId: string;
  connectionName: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof RotateCcw }> = {
  registered: { label: 'Aangemeld', variant: 'default', icon: RotateCcw },
  in_transit: { label: 'Onderweg', variant: 'secondary', icon: Package },
  received: { label: 'Ontvangen', variant: 'outline', icon: CheckCircle },
  approved: { label: 'Goedgekeurd', variant: 'outline', icon: CheckCircle },
  rejected: { label: 'Afgewezen', variant: 'destructive', icon: XCircle },
  exchanged: { label: 'Omgeruild', variant: 'secondary', icon: RotateCcw },
  repaired: { label: 'Gerepareerd', variant: 'secondary', icon: RotateCcw },
};

export function BolReturnsTab({ connectionId, connectionName }: BolReturnsTabProps) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['marketplace-returns', connectionId, currentTenant?.id],
    queryFn: async () => {
      if (!connectionId || !currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('returns')
        .select('*')
        .eq('marketplace_connection_id', connectionId)
        .eq('tenant_id', currentTenant.id)
        .order('registration_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!connectionId && !!currentTenant?.id,
  });

  const openReturns = returns.filter((r: any) => r.status === 'registered' || r.status === 'in_transit');

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-bol-returns', {
        body: { connectionId },
      });
      if (error) throw error;
      toast.success(`${data.returnsImported || 0} retouren gesynchroniseerd`);
      queryClient.invalidateQueries({ queryKey: ['marketplace-returns', connectionId] });
    } catch (err) {
      toast.error('Retouren sync mislukt');
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Retouren
            {openReturns.length > 0 && (
              <Badge variant="destructive" className="ml-2">{openReturns.length} open</Badge>
            )}
          </h3>
          <p className="text-sm text-muted-foreground">Retourzendingen van {connectionName}</p>
        </div>
        <Button onClick={handleSync} disabled={syncing} size="sm">
          {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Retouren ophalen
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{returns.length}</div>
            <p className="text-xs text-muted-foreground">Totaal retouren</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-orange-600">{openReturns.length}</div>
            <p className="text-xs text-muted-foreground">Open / in behandeling</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">
              {returns.filter((r: any) => r.status === 'approved' || r.status === 'received').length}
            </div>
            <p className="text-xs text-muted-foreground">Afgehandeld</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-red-600">
              {returns.filter((r: any) => r.status === 'rejected').length}
            </div>
            <p className="text-xs text-muted-foreground">Afgewezen</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : returns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <RotateCcw className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h4 className="font-medium text-muted-foreground">Geen retouren gevonden</h4>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Klik op "Retouren ophalen" om retouren van Bol.com te synchroniseren
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Retour ID</TableHead>
                <TableHead>Klant</TableHead>
                <TableHead>Reden</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((ret: any) => {
                const sc = statusConfig[ret.status] || statusConfig.registered;
                const items = Array.isArray(ret.items) ? ret.items : [];
                return (
                  <TableRow key={ret.id}>
                    <TableCell className="text-sm">
                      {ret.registration_date
                        ? format(new Date(ret.registration_date), 'dd MMM yyyy', { locale: nl })
                        : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{ret.marketplace_return_id}</TableCell>
                    <TableCell>{ret.customer_name || '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {ret.return_reason || ret.return_reason_code || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {items.slice(0, 2).map((item: any, idx: number) => (
                          <div key={idx} className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {item.quantity || 1}x {item.title || item.ean || 'Product'}
                          </div>
                        ))}
                        {items.length > 2 && (
                          <span className="text-xs text-muted-foreground">+{items.length - 2} meer</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
