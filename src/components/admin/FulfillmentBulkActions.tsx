import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BatchPrintDialog } from '@/components/admin/BatchPrintDialog';
import {
  ChevronDown,
  XCircle,
  Truck,
  CheckCircle,
  FileText,
  Printer,
  Download,
  Loader2,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { generatePackingSlipPdf } from '@/utils/packingSlipPdf';

interface FulfillmentOrder {
  id: string;
  order_number: string;
  customer_name: string | null;
  shipping_address: unknown;
  fulfillment_status: string | null;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  marketplace_source: string | null;
  created_at: string;
  item_count: number;
}

interface FulfillmentBulkActionsProps {
  selectedOrderIds: string[];
  orders: FulfillmentOrder[];
  onClearSelection: () => void;
  onComplete: () => void;
}

export function FulfillmentBulkActions({
  selectedOrderIds,
  orders,
  onClearSelection,
  onComplete,
}: FulfillmentBulkActionsProps) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [batchPrintOpen, setBatchPrintOpen] = useState(false);

  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));

  const handleMarkAsShipped = async () => {
    setLoadingAction('shipped');
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          fulfillment_status: 'shipped',
          status: 'shipped',
          shipped_at: new Date().toISOString(),
        })
        .in('id', selectedOrderIds);

      if (error) throw error;

      toast({ title: `${selectedOrderIds.length} order(s) als verzonden gemarkeerd` });
      queryClient.invalidateQueries({ queryKey: ['fulfillment-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onComplete();
    } catch (err: any) {
      toast({ title: 'Fout', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleMarkAsDelivered = async () => {
    setLoadingAction('delivered');
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          fulfillment_status: 'delivered',
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .in('id', selectedOrderIds);

      if (error) throw error;

      toast({ title: `${selectedOrderIds.length} order(s) als afgeleverd gemarkeerd` });
      queryClient.invalidateQueries({ queryKey: ['fulfillment-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onComplete();
    } catch (err: any) {
      toast({ title: 'Fout', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadPackingSlips = async () => {
    setLoadingAction('packing-slips');
    try {
      if (!currentTenant) throw new Error('Geen tenant');

      const { data: fullOrders, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('id', selectedOrderIds);

      if (error) throw error;

      const tenant = {
        name: currentTenant.name,
        address: currentTenant.address,
        city: currentTenant.city,
        postal_code: currentTenant.postal_code,
        country: currentTenant.country,
        phone: currentTenant.phone,
        email: currentTenant.owner_email,
        kvk_number: currentTenant.kvk_number,
      };

      const mergedPdf = await PDFDocument.create();

      for (const order of fullOrders || []) {
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
          tenant,
        );

        const srcDoc = await PDFDocument.load(pdfBytes);
        const pages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        pages.forEach((p) => mergedPdf.addPage(p));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `pakbonnen-${date}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast({ title: `${fullOrders?.length || 0} pakbon(nen) gedownload` });
    } catch (err: any) {
      toast({ title: 'Fout bij pakbonnen', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Bestelnummer', 'Klant', 'Status', 'Items', 'Carrier', 'Tracking', 'Datum'];
    const rows = selectedOrders.map((o) => [
      o.order_number,
      o.customer_name || '',
      o.fulfillment_status || 'unfulfilled',
      String(o.item_count),
      o.carrier || '',
      o.tracking_number || '',
      new Date(o.created_at).toLocaleDateString('nl-NL'),
    ]);

    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fulfillment-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    toast({ title: `${selectedOrders.length} order(s) geëxporteerd` });
  };

  if (selectedOrderIds.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-40 border-t bg-background shadow-lg animate-in slide-in-from-bottom-2 lg:left-[var(--sidebar-width,280px)]">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 max-w-screen-xl mx-auto">
          <span className="text-sm font-medium whitespace-nowrap">
            {selectedOrderIds.length} order{selectedOrderIds.length !== 1 ? 's' : ''} geselecteerd
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={!!loadingAction}>
                {loadingAction ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                Acties
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={handleMarkAsShipped}>
                <Truck className="h-4 w-4 mr-2" /> Markeer als verzonden
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleMarkAsDelivered}>
                <CheckCircle className="h-4 w-4 mr-2" /> Markeer als afgeleverd
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleDownloadPackingSlips}>
                <FileText className="h-4 w-4 mr-2" /> Pakbonnen downloaden
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setBatchPrintOpen(true)}>
                <Printer className="h-4 w-4 mr-2" /> Labels printen
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleExportCsv}>
                <Download className="h-4 w-4 mr-2" /> Exporteren naar CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" variant="ghost" onClick={onClearSelection} className="ml-auto">
            <XCircle className="h-4 w-4 mr-2" />
            Deselecteer
          </Button>
        </div>
      </div>

      <BatchPrintDialog
        open={batchPrintOpen}
        onOpenChange={setBatchPrintOpen}
        orderIds={selectedOrderIds}
        onComplete={onComplete}
      />
    </>
  );
}
