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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BatchPrintDialog } from '@/components/admin/BatchPrintDialog';
import {
  ChevronUp,
  XCircle,
  Truck,
  CheckCircle,
  Clock,
  Ban,
  CreditCard,
  FileText,
  Printer,
  Download,
  Trash2,
  Loader2,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { generatePackingSlipPdf } from '@/utils/packingSlipPdf';
import type { Order, OrderStatus, PaymentStatus } from '@/types/order';

interface OrderBulkActionsProps {
  selectedOrderIds: string[];
  orders: Order[];
  onClearSelection: () => void;
  onComplete: () => void;
}

export function OrderBulkActions({
  selectedOrderIds,
  orders,
  onClearSelection,
  onComplete,
}: OrderBulkActionsProps) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchPrintOpen, setBatchPrintOpen] = useState(false);

  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));

  const handleBulkStatusUpdate = async (status: OrderStatus) => {
    setLoadingAction(`status-${status}`);
    try {
      const updateData: Record<string, unknown> = { status };
      if (status === 'shipped') updateData.shipped_at = new Date().toISOString();
      if (status === 'delivered') updateData.delivered_at = new Date().toISOString();
      if (status === 'cancelled') updateData.cancelled_at = new Date().toISOString();

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .in('id', selectedOrderIds);

      if (error) throw error;

      toast({ title: `${selectedOrderIds.length} order(s) bijgewerkt naar ${status}` });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onComplete();
    } catch (err: any) {
      toast({ title: 'Fout bij statuswijziging', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBulkPaymentUpdate = async (paymentStatus: PaymentStatus) => {
    setLoadingAction(`payment-${paymentStatus}`);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: paymentStatus })
        .in('id', selectedOrderIds);

      if (error) throw error;

      toast({ title: `${selectedOrderIds.length} order(s) betaalstatus bijgewerkt` });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onComplete();
    } catch (err: any) {
      toast({ title: 'Fout bij betaalstatus', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadPackingSlips = async () => {
    setLoadingAction('packing-slips');
    try {
      if (!currentTenant) throw new Error('Geen tenant');

      // Fetch full order data with items
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

      // Generate and merge PDFs
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
    const headers = ['Bestelnummer', 'Klant', 'Email', 'Status', 'Betaalstatus', 'Totaal', 'Datum', 'Tracking', 'Carrier'];
    const rows = selectedOrders.map((o) => [
      o.order_number,
      o.customer_name || '',
      o.customer_email,
      o.status,
      o.payment_status,
      String(o.total),
      new Date(o.created_at).toLocaleDateString('nl-NL'),
      o.tracking_number || '',
      o.carrier || '',
    ]);

    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    toast({ title: `${selectedOrders.length} order(s) geëxporteerd` });
  };

  const handleBulkDelete = async () => {
    setLoadingAction('delete');
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .in('id', selectedOrderIds);

      if (error) throw error;

      toast({ title: `${selectedOrderIds.length} order(s) verwijderd` });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onClearSelection();
    } catch (err: any) {
      toast({ title: 'Fout bij verwijderen', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
      setDeleteDialogOpen(false);
    }
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
                {loadingAction ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronUp className="h-4 w-4 mr-2" />}
                Acties
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              {/* Status sub-menu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Clock className="h-4 w-4 mr-2" />
                  Status wijzigen
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate('pending')}>
                    <Clock className="h-4 w-4 mr-2" /> In afwachting
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate('processing')}>
                    <Clock className="h-4 w-4 mr-2" /> In behandeling
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate('shipped')}>
                    <Truck className="h-4 w-4 mr-2" /> Verzonden
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate('delivered')}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Afgeleverd
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate('cancelled')} className="text-destructive">
                    <Ban className="h-4 w-4 mr-2" /> Geannuleerd
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Payment sub-menu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Betaalstatus wijzigen
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleBulkPaymentUpdate('paid')}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Betaald
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkPaymentUpdate('pending')}>
                    <Clock className="h-4 w-4 mr-2" /> In afwachting
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkPaymentUpdate('refunded')}>
                    <CreditCard className="h-4 w-4 mr-2" /> Terugbetaald
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleDownloadPackingSlips}>
                <FileText className="h-4 w-4 mr-2" /> Pakbonnen downloaden
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setBatchPrintOpen(true)}>
                <Printer className="h-4 w-4 mr-2" /> Labels printen
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleExportCsv}>
                <Download className="h-4 w-4 mr-2" /> Exporteren naar CSV
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" variant="ghost" onClick={onClearSelection} className="ml-auto">
            <XCircle className="h-4 w-4 mr-2" />
            Deselecteer
          </Button>
        </div>
      </div>

      {/* Batch Print Dialog */}
      <BatchPrintDialog
        open={batchPrintOpen}
        onOpenChange={setBatchPrintOpen}
        orderIds={selectedOrderIds}
        onComplete={onComplete}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Orders verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {selectedOrderIds.length} order(s) wilt verwijderen? 
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loadingAction === 'delete'}
            >
              {loadingAction === 'delete' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
