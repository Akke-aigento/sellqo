import { useState, useEffect } from 'react';
import { Truck, ExternalLink, Send, X, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CARRIER_PATTERNS, generateTrackingUrl, getCarrierById } from '@/lib/carrierPatterns';
import { useOrderShipping } from '@/hooks/useOrderShipping';
import type { Order, Address } from '@/types/order';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

const TRACKING_STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  not_found: { label: 'Niet gevonden', variant: 'outline' },
  picked_up: { label: 'Opgehaald', variant: 'secondary' },
  in_transit: { label: 'Onderweg', variant: 'default', className: 'bg-blue-500 hover:bg-blue-500/80' },
  out_for_delivery: { label: 'In bezorging', variant: 'default', className: 'bg-orange-500 hover:bg-orange-500/80' },
  delivered: { label: 'Bezorgd', variant: 'default', className: 'bg-green-600 hover:bg-green-600/80' },
  exception: { label: 'Probleem', variant: 'destructive' },
  expired: { label: 'Verlopen', variant: 'outline' },
  undelivered: { label: 'Niet bezorgd', variant: 'destructive' },
};

// Normalize carrier IDs from various sources (e.g. Bol.com uses BPOST_BE)
function normalizeCarrierId(raw: string): string {
  const norm = raw.toLowerCase().replace(/[_\-\s]+/g, '');
  if (norm.includes('bpost')) return 'bpost';
  if (norm.includes('postnl') || norm === 'tnt') return 'postnl';
  if (norm.includes('dhl') && norm.includes('ecommerce')) return 'dhl_ecommerce';
  if (norm.includes('dhl')) return 'dhl';
  if (norm.includes('dpd')) return 'dpd';
  if (norm.includes('ups')) return 'ups';
  if (norm.includes('gls')) return 'gls';
  if (norm.includes('fedex')) return 'fedex';
  return raw;
}

interface TrackingInfoCardProps {
  order: Order;
  embedded?: boolean;
}

export function TrackingInfoCard({ order, embedded = false }: TrackingInfoCardProps) {
  const { updateTracking, clearTracking, isUpdating, isClearing } = useOrderShipping();
  
  // Normalize carrier from external sources
  const normalizedOrderCarrier = normalizeCarrierId(order.carrier || '');
  
  // Get postal code from shipping address for PostNL
  const shippingAddress = order.shipping_address as unknown as Address | null;
  const postalCode = shippingAddress?.postal_code || '';

  // Generate fallback tracking URL if missing
  const effectiveTrackingUrl = order.tracking_url || 
    (order.tracking_number && normalizedOrderCarrier ? 
      generateTrackingUrl(normalizedOrderCarrier, order.tracking_number, postalCode) || '' : '');

  const [carrier, setCarrier] = useState(normalizedOrderCarrier);
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || '');
  const [trackingUrl, setTrackingUrl] = useState(effectiveTrackingUrl);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [isEditing, setIsEditing] = useState(!order.tracking_number);

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
  const trackingStatusConfig = order.tracking_status ? TRACKING_STATUS_CONFIG[order.tracking_status] : null;

  // Display mode - show existing tracking info
  if (!isEditing && hasTrackingInfo) {
    const displayContent = (
      <div className="space-y-4">
        {/* Tracking status badge */}
        {trackingStatusConfig && (
          <div className="flex items-center justify-between">
            <Badge variant={trackingStatusConfig.variant} className={trackingStatusConfig.className}>
              {trackingStatusConfig.label}
            </Badge>
            {order.last_tracking_check && (
              <span className="text-xs text-muted-foreground">
                Gecheckt {formatDistanceToNow(new Date(order.last_tracking_check), { addSuffix: true, locale: nl })}
              </span>
            )}
          </div>
        )}
        
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
      </div>
    );

    if (embedded) return displayContent;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Verzending
          </CardTitle>
        </CardHeader>
        <CardContent>{displayContent}</CardContent>
      </Card>
    );
  }

  // Edit mode
  const editContent = (
    <div className="space-y-4">
      {!embedded && (
        <p className="text-sm text-muted-foreground">
          {hasTrackingInfo ? 'Bewerk tracking informatie' : 'Voeg tracking informatie toe'}
        </p>
      )}
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
    </div>
  );

  if (embedded) return editContent;

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
      <CardContent>{editContent}</CardContent>
    </Card>
  );
}
