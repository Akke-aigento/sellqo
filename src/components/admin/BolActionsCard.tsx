import { useState } from 'react';
import { Package, Send, Download, Loader2, CheckCircle, AlertCircle, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Order } from '@/types/order';

interface BolActionsCardProps {
  order: Order;
}

interface ShippingLabel {
  id: string;
  provider: string;
  carrier: string | null;
  tracking_number: string | null;
  label_url: string | null;
  status: string;
  created_at: string;
}

export function BolActionsCard({ order }: BolActionsCardProps) {
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);

  // Only show for Bol.com orders
  if (order.marketplace_source !== 'bol_com') {
    return null;
  }

  // Fetch VVB labels for this order
  const { data: labels, isLoading: labelsLoading } = useQuery({
    queryKey: ['shipping-labels', order.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_labels')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ShippingLabel[];
    },
  });

  const vvbLabels = labels?.filter(l => l.provider === 'bol_vvb') || [];
  const hasVvbLabel = vvbLabels.length > 0;
  const latestLabel = vvbLabels[0];

  // Manual confirmation to Bol.com
  const confirmToBol = useMutation({
    mutationFn: async () => {
      if (!order.tracking_number || !order.carrier) {
        throw new Error('Tracking nummer en carrier zijn vereist');
      }

      const { data, error } = await supabase.functions.invoke('confirm-bol-shipment', {
        body: {
          order_id: order.id,
          tracking_number: order.tracking_number,
          carrier: order.carrier,
          tracking_url: order.tracking_url,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Bevestiging mislukt');
      
      return data;
    },
    onSuccess: () => {
      toast.success('Verzending bevestigd naar Bol.com');
      queryClient.invalidateQueries({ queryKey: ['order', order.id] });
    },
    onError: (error: Error) => {
      toast.error(`Fout bij bevestigen: ${error.message}`);
    },
  });

  // Create VVB label
  const createVvbLabel = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('create-bol-vvb-label', {
        body: {
          order_id: order.id,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Label aanmaken mislukt');
      
      return data;
    },
    onSuccess: (data) => {
      toast.success('VVB label aangemaakt');
      queryClient.invalidateQueries({ queryKey: ['shipping-labels', order.id] });
      queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      
      // Auto-open label if available
      if (data.label_url) {
        window.open(data.label_url, '_blank');
      }
    },
    onError: (error: Error) => {
      toast.error(`Fout bij label aanmaken: ${error.message}`);
    },
  });

  const handleConfirmToBol = async () => {
    setIsConfirming(true);
    try {
      await confirmToBol.mutateAsync();
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCreateVvbLabel = async () => {
    setIsCreatingLabel(true);
    try {
      await createVvbLabel.mutateAsync();
    } finally {
      setIsCreatingLabel(false);
    }
  };

  const syncStatus = order.sync_status || order.fulfillment_status;
  const isShipped = syncStatus === 'shipped' || order.status === 'shipped';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Bol.com Acties
        </CardTitle>
        <CardDescription>
          Marketplace ID: <span className="font-mono text-xs">{order.marketplace_order_id}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Bol.com Status</span>
          {isShipped ? (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Bevestigd
            </Badge>
          ) : (
            <Badge variant="secondary">
              In afwachting
            </Badge>
          )}
        </div>

        {/* VVB Label Section */}
        {hasVvbLabel && latestLabel && (
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">VVB Label</span>
              <Badge variant="outline">{latestLabel.carrier}</Badge>
            </div>
            {latestLabel.tracking_number && (
              <div className="text-xs text-muted-foreground">
                Track: <span className="font-mono">{latestLabel.tracking_number}</span>
              </div>
            )}
            {latestLabel.label_url && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.open(latestLabel.label_url!, '_blank')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Label
              </Button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {/* Create VVB Label - only if not already shipped and no VVB label */}
          {!isShipped && !hasVvbLabel && (
            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={handleCreateVvbLabel}
              disabled={isCreatingLabel}
            >
              {isCreatingLabel ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Truck className="h-4 w-4 mr-2" />
              )}
              VVB Label Aanmaken
            </Button>
          )}

          {/* Manual Confirm to Bol.com - only if has tracking but not confirmed */}
          {!isShipped && order.tracking_number && order.carrier && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleConfirmToBol}
              disabled={isConfirming}
            >
              {isConfirming ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Bevestig naar Bol.com
            </Button>
          )}

          {/* Info message if no tracking yet */}
          {!isShipped && !order.tracking_number && !hasVvbLabel && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Voeg eerst trackinginformatie toe of maak een VVB label aan.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
