import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  MapPin,
  User,
  FileText,
  Truck,
  Printer,
  Tag,
  ExternalLink,
  Save,
  CheckCircle2,
  StickyNote,
} from 'lucide-react';
import { generatePackingSlipPdf } from '@/utils/packingSlipPdf';

interface FulfillmentOrderSheetProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
}

export function FulfillmentOrderSheet({ orderId, open, onOpenChange, onStatusChange }: FulfillmentOrderSheetProps) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [internalNotes, setInternalNotes] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);

  // Fetch full order data with items and labels
  const { data: order, isLoading } = useQuery({
    queryKey: ['fulfillment-order-detail', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, customer_name, customer_email, customer_phone,
          shipping_address, billing_address, notes, internal_notes,
          fulfillment_status, status, carrier, tracking_number, tracking_url,
          marketplace_source, created_at, sales_channel,
          order_items (id, product_name, product_sku, product_image, quantity, unit_price, total_price)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;

      // Fetch shipping labels separately
      const { data: labels } = await supabase
        .from('shipping_labels')
        .select('id, label_url, carrier, tracking_number, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (!notesLoaded) {
        setInternalNotes(data?.internal_notes || '');
        setNotesLoaded(true);
      }

      return { ...data, shipping_labels: labels || [] };
    },
    enabled: !!orderId && open,
  });

  // Reset notes loaded state when order changes
  const [prevOrderId, setPrevOrderId] = useState<string | null>(null);
  if (orderId !== prevOrderId) {
    setPrevOrderId(orderId);
    setNotesLoaded(false);
  }

  // Save internal notes
  const saveNotes = useMutation({
    mutationFn: async () => {
      if (!orderId) return;
      const { error } = await supabase
        .from('orders')
        .update({ internal_notes: internalNotes })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fulfillment-order-detail', orderId] });
      toast({ title: 'Notities opgeslagen' });
    },
  });

  // Quick status update
  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!orderId) return;
      const updateData: Record<string, unknown> = { fulfillment_status: newStatus };
      if (newStatus === 'shipped') {
        updateData.status = 'shipped';
        updateData.shipped_at = new Date().toISOString();
      } else if (newStatus === 'delivered') {
        updateData.status = 'delivered';
        updateData.delivered_at = new Date().toISOString();
      }
      const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fulfillment-orders'] });
      queryClient.invalidateQueries({ queryKey: ['fulfillment-order-detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['fulfillment-stats'] });
      toast({ title: 'Status bijgewerkt' });
      onStatusChange?.();
    },
  });

  // Generate single packing slip
  const handleDownloadPackingSlip = async () => {
    if (!order || !currentTenant) return;
    try {
      const pdfBytes = await generatePackingSlipPdf(
        {
          order_number: order.order_number,
          created_at: order.created_at,
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          shipping_address: order.shipping_address,
          order_items: order.order_items?.map((item: any) => ({
            product_name: item.product_name,
            product_sku: item.product_sku,
            quantity: item.quantity,
          })),
        },
        {
          name: currentTenant.name,
          address: currentTenant.address,
          city: currentTenant.city,
          postal_code: currentTenant.postal_code,
          country: currentTenant.country,
          phone: currentTenant.phone,
          email: currentTenant.owner_email,
          kvk_number: currentTenant.kvk_number,
          logo_url: currentTenant.logo_url,
          document_logo_url: (currentTenant as any).document_logo_url,
        },
      );
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err: any) {
      toast({ title: 'Fout bij pakbon', description: err.message, variant: 'destructive' });
    }
  };

  // Open shipping label
  const handleOpenLabel = () => {
    const label = order?.shipping_labels?.[0];
    if (label?.label_url) {
      window.open(label.label_url, '_blank');
    } else {
      toast({ title: 'Geen label beschikbaar', description: 'Er is nog geen verzendlabel voor deze order.' });
    }
  };

  const parseAddress = (address: unknown): string[] => {
    if (!address || typeof address !== 'object') return ['Geen adres'];
    const addr = address as Record<string, string>;
    const lines: string[] = [];
    if (addr.street) lines.push(addr.street);
    if (addr.postal_code || addr.city) lines.push([addr.postal_code, addr.city].filter(Boolean).join(' '));
    if (addr.country) lines.push(addr.country);
    return lines.length > 0 ? lines : ['Geen adres'];
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'shipped': return <Badge className="bg-blue-500">Verzonden</Badge>;
      case 'delivered': return <Badge className="bg-green-500">Afgeleverd</Badge>;
      case 'partial': return <Badge variant="secondary">Deels verzonden</Badge>;
      default: return <Badge variant="outline">Te verzenden</Badge>;
    }
  };

  const currentStatus = order?.fulfillment_status;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {order?.order_number || 'Laden...'}
          </SheetTitle>
          <SheetDescription>
            Orderdetails en fulfillment acties
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : order ? (
          <div className="space-y-5 pb-6">
            {/* Status + Quick Actions */}
            <div className="flex items-center justify-between">
              {getStatusBadge(currentStatus)}
              <div className="flex gap-2">
                {(!currentStatus || currentStatus === 'unfulfilled' || currentStatus === 'pending') && (
                  <Button size="sm" onClick={() => updateStatus.mutate('shipped')} disabled={updateStatus.isPending}>
                    <Truck className="h-4 w-4 mr-1" />
                    Verzonden
                  </Button>
                )}
                {(currentStatus === 'shipped' || currentStatus === 'fulfilled') && (
                  <Button size="sm" onClick={() => updateStatus.mutate('delivered')} disabled={updateStatus.isPending}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Afgeleverd
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* Customer Info */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <User className="h-4 w-4" /> Klant
              </h3>
              <div className="text-sm space-y-1">
                <p className="font-medium">{order.customer_name || 'Onbekend'}</p>
                {order.customer_email && <p className="text-muted-foreground">{order.customer_email}</p>}
                {order.customer_phone && <p className="text-muted-foreground">{order.customer_phone}</p>}
              </div>
            </div>

            {/* Shipping Address */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4" /> Verzendadres
              </h3>
              <div className="text-sm text-muted-foreground space-y-0.5">
                {parseAddress(order.shipping_address).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>

            <Separator />

            {/* Products */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Package className="h-4 w-4" /> Producten ({order.order_items?.length || 0})
              </h3>
              <div className="space-y-2">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-md border p-2">
                    {item.product_image ? (
                      <img src={item.product_image} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      {item.product_sku && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Tag className="h-3 w-3" /> {item.product_sku}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      ×{item.quantity}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Tracking Info */}
            {order.tracking_number && (
              <>
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <Truck className="h-4 w-4" /> Tracking
                  </h3>
                  <div className="text-sm space-y-1">
                    {order.carrier && <p className="text-muted-foreground capitalize">{order.carrier}</p>}
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{order.tracking_number}</code>
                      {order.tracking_url && (
                        <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Document Actions */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4" /> Documenten
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleDownloadPackingSlip}>
                  <Printer className="h-4 w-4 mr-1" />
                  Pakbon
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenLabel}
                  disabled={!order.shipping_labels?.length}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Verzendlabel
                  {!order.shipping_labels?.length && (
                    <span className="text-xs text-muted-foreground ml-1">(geen)</span>
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <StickyNote className="h-4 w-4" /> Notities
              </h3>
              {order.notes && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2 mb-3">
                  <p className="text-xs font-medium text-foreground mb-1">Klantnotitie:</p>
                  {order.notes}
                </div>
              )}
              <div className="space-y-2">
                <Textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Interne notitie toevoegen (bijv. verpakking, bijzonderheden)..."
                  rows={3}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveNotes.mutate()}
                  disabled={saveNotes.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Opslaan
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
