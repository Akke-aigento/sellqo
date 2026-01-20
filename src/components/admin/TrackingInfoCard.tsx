import { useState, useEffect } from 'react';
import { Truck, ExternalLink, Send, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CARRIER_PATTERNS, generateTrackingUrl, getCarrierById } from '@/lib/carrierPatterns';
import { useOrderShipping } from '@/hooks/useOrderShipping';
import type { Order, Address } from '@/types/order';

interface TrackingInfoCardProps {
  order: Order;
}

export function TrackingInfoCard({ order }: TrackingInfoCardProps) {
  const { updateTracking, clearTracking, isUpdating, isClearing } = useOrderShipping();
  
  const [carrier, setCarrier] = useState(order.carrier || '');
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || '');
  const [trackingUrl, setTrackingUrl] = useState(order.tracking_url || '');
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [isEditing, setIsEditing] = useState(!order.tracking_number);

  // Get postal code from shipping address for PostNL
  const shippingAddress = order.shipping_address as unknown as Address | null;
  const postalCode = shippingAddress?.postal_code || '';

  // Auto-generate tracking URL when carrier or tracking number changes
  useEffect(() => {
    if (carrier && trackingNumber && carrier !== 'other') {
      const generatedUrl = generateTrackingUrl(carrier, trackingNumber, postalCode);
      if (generatedUrl) {
        setTrackingUrl(generatedUrl);
      }
    }
  }, [carrier, trackingNumber, postalCode]);

  const handleSave = async () => {
    if (!trackingNumber.trim()) return;

    await updateTracking.mutateAsync({
      orderId: order.id,
      carrier,
      trackingNumber: trackingNumber.trim(),
      trackingUrl: trackingUrl.trim(),
      notifyCustomer,
      customerEmail: order.customer_email,
      customerName: order.customer_name || undefined,
      orderNumber: order.order_number,
    });
    
    setIsEditing(false);
  };

  const handleClear = async () => {
    await clearTracking.mutateAsync(order.id);
    setCarrier('');
    setTrackingNumber('');
    setTrackingUrl('');
    setIsEditing(true);
  };

  const carrierInfo = getCarrierById(carrier);
  const hasTrackingInfo = order.tracking_number && order.carrier;

  // Display mode - show existing tracking info
  if (!isEditing && hasTrackingInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Verzending
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Carrier</span>
              <span className="font-medium">{carrierInfo?.name || order.carrier}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tracknummer</span>
              <span className="font-mono text-xs">{order.tracking_number}</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            {order.tracking_url && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => window.open(order.tracking_url!, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Track & Trace
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              Bewerken
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Edit mode
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Verzending
        </CardTitle>
        <CardDescription>
          {hasTrackingInfo ? 'Bewerk tracking informatie' : 'Voeg tracking informatie toe'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="carrier">Carrier</Label>
          <Select value={carrier} onValueChange={setCarrier}>
            <SelectTrigger id="carrier">
              <SelectValue placeholder="Selecteer carrier" />
            </SelectTrigger>
            <SelectContent>
              {CARRIER_PATTERNS.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="trackingNumber">Tracknummer</Label>
          <Input
            id="trackingNumber"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Bijv. 3STEST1234567890"
            className="font-mono text-sm"
          />
        </div>

        {carrier === 'other' && (
          <div className="space-y-2">
            <Label htmlFor="trackingUrl">Tracking URL</Label>
            <Input
              id="trackingUrl"
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </div>
        )}

        {carrier && carrier !== 'other' && trackingNumber && trackingUrl && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
            <span className="font-medium">URL:</span>{' '}
            <a 
              href={trackingUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all"
            >
              {trackingUrl.substring(0, 50)}...
            </a>
          </div>
        )}

        <div className="flex items-center space-x-2 pt-2">
          <Checkbox
            id="notifyCustomer"
            checked={notifyCustomer}
            onCheckedChange={(checked) => setNotifyCustomer(checked as boolean)}
          />
          <Label htmlFor="notifyCustomer" className="text-sm font-normal cursor-pointer">
            Klant per email informeren
          </Label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={!trackingNumber.trim() || !carrier || isUpdating}
            className="flex-1"
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {notifyCustomer ? 'Opslaan & Versturen' : 'Opslaan'}
          </Button>
          
          {hasTrackingInfo && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(false)}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClear}
                disabled={isClearing}
              >
                {isClearing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Wissen'
                )}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
