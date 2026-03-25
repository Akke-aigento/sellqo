import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { RefreshCw, RotateCcw, Package, CheckCircle, XCircle, Loader2, ChevronRight, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

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
  const { updateConnection } = useMarketplaceConnections();
  const [syncing, setSyncing] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [autoAccept, setAutoAccept] = useState(false);

  // Load connection settings for auto-accept
  const { data: connection } = useQuery({
    queryKey: ['marketplace-connection', connectionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('marketplace_connections')
        .select('settings')
        .eq('id', connectionId)
        .single();
      return data;
    },
    enabled: !!connectionId,
  });

  // Sync auto-accept state from connection settings
  const connSettings = connection?.settings as Record<string, unknown> | null;
  const connAutoAccept = !!connSettings?.autoAcceptReturns;
  if (connAutoAccept !== autoAccept && connection) {
    // Only update once when data loads
    setAutoAccept(connAutoAccept);
  }

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

  const handleAction = useMutation({
    mutationFn: async ({ returnId, action }: { returnId: string; action: 'accept' | 'reject' }) => {
      const { data, error } = await supabase.functions.invoke('handle-bol-return', {
        body: { connectionId, returnId, action, internalNotes: notes || undefined },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'accept' ? 'Retour geaccepteerd' : 'Retour afgewezen');
      queryClient.invalidateQueries({ queryKey: ['marketplace-returns', connectionId] });
      setSelectedReturn(null);
      setNotes('');
    },
    onError: (err) => {
      toast.error(`Actie mislukt: ${err.message}`);
    },
  });

  const saveNotes = useMutation({
    mutationFn: async ({ returnId, text }: { returnId: string; text: string }) => {
      const { error } = await supabase
        .from('returns')
        .update({ internal_notes: text, updated_at: new Date().toISOString() })
        .eq('id', returnId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Notitie opgeslagen');
      queryClient.invalidateQueries({ queryKey: ['marketplace-returns', connectionId] });
    },
  });

  const toggleAutoAccept = async (checked: boolean) => {
    setAutoAccept(checked);
    try {
      const currentSettings = (connection?.settings || {}) as Record<string, unknown>;
      updateConnection.mutate({
        id: connectionId,
        updates: {
          settings: { ...currentSettings, autoAcceptReturns: checked } as unknown as any,
        },
      });
    } catch {
      toast.error('Instelling opslaan mislukt');
    }
  };

  const openDetail = (ret: any) => {
    setSelectedReturn(ret);
    setNotes(ret.internal_notes || '');
  };

  const isOpen = (r: any) => r.status === 'registered' || r.status === 'in_transit';

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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={autoAccept} onCheckedChange={toggleAutoAccept} />
            <span className="text-sm text-muted-foreground">Auto-accepteren</span>
          </div>
          <Button onClick={handleSync} disabled={syncing} size="sm">
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Retouren ophalen
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold">{returns.length}</div>
          <p className="text-xs text-muted-foreground">Totaal retouren</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold text-orange-600">{openReturns.length}</div>
          <p className="text-xs text-muted-foreground">Open / in behandeling</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold text-green-600">
            {returns.filter((r: any) => r.status === 'approved' || r.status === 'received').length}
          </div>
          <p className="text-xs text-muted-foreground">Afgehandeld</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold text-red-600">
            {returns.filter((r: any) => r.status === 'rejected').length}
          </div>
          <p className="text-xs text-muted-foreground">Afgewezen</p>
        </CardContent></Card>
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
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((ret: any) => {
                const sc = statusConfig[ret.status] || statusConfig.registered;
                const items = Array.isArray(ret.items) ? ret.items : [];
                return (
                  <TableRow
                    key={ret.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(ret)}
                  >
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
                    <TableCell>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedReturn} onOpenChange={(open) => { if (!open) setSelectedReturn(null); }}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          {selectedReturn && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  Retour #{selectedReturn.marketplace_return_id}
                  <Badge variant={statusConfig[selectedReturn.status]?.variant || 'default'}>
                    {statusConfig[selectedReturn.status]?.label || selectedReturn.status}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  {selectedReturn.registration_date
                    ? format(new Date(selectedReturn.registration_date), 'dd MMMM yyyy HH:mm', { locale: nl })
                    : 'Datum onbekend'}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Customer info */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">Klantgegevens</h4>
                  <p className="text-sm">{selectedReturn.customer_name || 'Onbekend'}</p>
                  {selectedReturn.marketplace_order_id && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Bestelling: {selectedReturn.marketplace_order_id}
                    </p>
                  )}
                </div>

                {/* Return reason */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">Reden van retour</h4>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-sm font-medium">{selectedReturn.return_reason_code || 'Niet opgegeven'}</p>
                    {selectedReturn.return_reason && selectedReturn.return_reason !== selectedReturn.return_reason_code && (
                      <p className="text-sm text-muted-foreground mt-1">{selectedReturn.return_reason}</p>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">Producten</h4>
                  <div className="space-y-2">
                    {(Array.isArray(selectedReturn.items) ? selectedReturn.items : []).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-start justify-between bg-muted rounded-lg p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title || 'Product'}</p>
                          {item.ean && <p className="text-xs text-muted-foreground">EAN: {item.ean}</p>}
                          {item.returnReason && (
                            <p className="text-xs text-muted-foreground mt-1">Reden: {item.returnReason}</p>
                          )}
                          {item.returnReasonDetail && (
                            <p className="text-xs text-muted-foreground">{item.returnReasonDetail}</p>
                          )}
                        </div>
                        <span className="text-sm font-medium ml-2">{item.quantity || 1}x</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Internal notes */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Interne notities
                  </h4>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Voeg een notitie toe over deze retour..."
                    rows={3}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={saveNotes.isPending}
                    onClick={() => saveNotes.mutate({ returnId: selectedReturn.id, text: notes })}
                  >
                    {saveNotes.isPending ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : null}
                    Notitie opslaan
                  </Button>
                </div>

                {/* Action buttons — only for open returns */}
                {isOpen(selectedReturn) && (
                  <div className="border-t pt-4 flex gap-3">
                    <Button
                      className="flex-1"
                      variant="default"
                      disabled={handleAction.isPending}
                      onClick={() => handleAction.mutate({ returnId: selectedReturn.id, action: 'accept' })}
                    >
                      {handleAction.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Accepteren
                    </Button>
                    <Button
                      className="flex-1"
                      variant="destructive"
                      disabled={handleAction.isPending}
                      onClick={() => handleAction.mutate({ returnId: selectedReturn.id, action: 'reject' })}
                    >
                      {handleAction.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      Afwijzen
                    </Button>
                  </div>
                )}

                {/* Already handled */}
                {!isOpen(selectedReturn) && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground text-center">
                      Deze retour is al afgehandeld ({statusConfig[selectedReturn.status]?.label || selectedReturn.status})
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
