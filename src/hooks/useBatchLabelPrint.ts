import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLabelPrinter } from './useLabelPrinter';
import { mergePdfs, downloadMergedPdf, openMergedPdfForPrint } from '@/utils/pdfMerge';
import { toast } from 'sonner';

export interface BatchPrintStatus {
  orderId: string;
  orderNumber: string;
  status: 'pending' | 'printing' | 'success' | 'error' | 'no_label';
  labelUrl?: string;
  carrier?: string;
  error?: string;
}

export interface BatchPrintProgress {
  current: number;
  total: number;
  statuses: BatchPrintStatus[];
}

export type PrintMethod = 'webusb' | 'browser' | 'download';

export function useBatchLabelPrint() {
  const [isPrinting, setIsPrinting] = useState(false);
  const [progress, setProgress] = useState<BatchPrintProgress | null>(null);
  const { connectedPrinter, printLabel } = useLabelPrinter();

  /**
   * Fetch labels for multiple orders
   */
  const fetchLabelsForOrders = useCallback(async (orderIds: string[]): Promise<BatchPrintStatus[]> => {
    const statuses: BatchPrintStatus[] = [];

    // Fetch orders with their labels
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        shipping_labels (
          id,
          label_url,
          carrier,
          tracking_number
        )
      `)
      .in('id', orderIds);

    if (error) {
      console.error('Error fetching orders for batch print:', error);
      throw error;
    }

    // De bucket `shipping-labels` is privé: rauwe `label_url`-waardes
    // (/object/public/…) geven 400/403. We signen daarom per label via
    // `get-document-url` (kolom `label_path`, TTL 600s).
    const labelIdByOrder = new Map<string, { labelId: string; carrier?: string }>();
    for (const order of orders || []) {
      const labels = order.shipping_labels as Array<{ id: string; carrier: string | null }> | null;
      const latestLabel = labels?.[0];
      if (latestLabel?.id) {
        labelIdByOrder.set(order.id, { labelId: latestLabel.id, carrier: latestLabel.carrier || undefined });
      }
    }

    const labelIds = Array.from(labelIdByOrder.values()).map(v => v.labelId);
    const signedById = new Map<string, string>();

    if (labelIds.length > 0) {
      const { data, error: signError } = await supabase.functions.invoke('get-document-url', {
        body: { doc_type: 'shipping_label', kind: 'pdf', doc_ids: labelIds },
      });
      if (signError) {
        console.error('Error signing label URLs:', signError);
      } else {
        const files = (data as { files?: Array<{ id: string; url: string }> } | null)?.files ?? [];
        for (const f of files) {
          if (f?.id && f?.url) signedById.set(f.id, f.url);
        }
      }
    }

    for (const order of orders || []) {
      const entry = labelIdByOrder.get(order.id);
      const signedUrl = entry ? signedById.get(entry.labelId) : undefined;

      statuses.push({
        orderId: order.id,
        orderNumber: order.order_number || order.id.slice(0, 8),
        status: signedUrl ? 'pending' : 'no_label',
        labelUrl: signedUrl,
        carrier: entry?.carrier,
      });
    }

    return statuses;
  }, []);

  /**
   * Print labels via WebUSB (direct to printer)
   */
  const printViaWebUSB = useCallback(async (statuses: BatchPrintStatus[]): Promise<BatchPrintStatus[]> => {
    const labelsToprint = statuses.filter(s => s.status === 'pending' && s.labelUrl);
    const results = [...statuses];

    for (let i = 0; i < labelsToprint.length; i++) {
      const labelStatus = labelsToprint[i];
      const resultIndex = results.findIndex(r => r.orderId === labelStatus.orderId);

      // Update status to printing
      results[resultIndex] = { ...results[resultIndex], status: 'printing' };
      setProgress(prev => prev ? { ...prev, current: i, statuses: results } : null);

      try {
        if (labelStatus.labelUrl) {
          const success = await printLabel(labelStatus.labelUrl);
          results[resultIndex] = {
            ...results[resultIndex],
            status: success ? 'success' : 'error',
            error: success ? undefined : 'Print failed',
          };
        }
      } catch (error) {
        results[resultIndex] = {
          ...results[resultIndex],
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }

      // Update progress
      setProgress(prev => prev ? { ...prev, current: i + 1, statuses: results } : null);

      // Small delay between prints to prevent overwhelming the printer
      if (i < labelsToprint.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }, [printLabel]);

  /**
   * Print labels via browser print dialog (merged PDF)
   */
  const printViaBrowser = useCallback(async (statuses: BatchPrintStatus[]): Promise<BatchPrintStatus[]> => {
    const labelsToprint = statuses.filter(s => s.status === 'pending' && s.labelUrl);
    const pdfUrls = labelsToprint.map(l => l.labelUrl!);

    try {
      await openMergedPdfForPrint(pdfUrls);
      
      // Mark all as success (we can't know if user actually printed)
      return statuses.map(s => 
        s.status === 'pending' && s.labelUrl 
          ? { ...s, status: 'success' as const } 
          : s
      );
    } catch (error) {
      console.error('Error opening merged PDF:', error);
      return statuses.map(s => 
        s.status === 'pending' 
          ? { ...s, status: 'error' as const, error: 'Failed to merge PDFs' } 
          : s
      );
    }
  }, []);

  /**
   * Download labels as merged PDF
   */
  const downloadLabels = useCallback(async (statuses: BatchPrintStatus[]): Promise<BatchPrintStatus[]> => {
    const labelsToDownload = statuses.filter(s => s.status === 'pending' && s.labelUrl);
    const pdfUrls = labelsToDownload.map(l => l.labelUrl!);

    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      await downloadMergedPdf(pdfUrls, `labels-${timestamp}.pdf`);
      
      toast.success(`${pdfUrls.length} labels gedownload`);
      
      return statuses.map(s => 
        s.status === 'pending' && s.labelUrl 
          ? { ...s, status: 'success' as const } 
          : s
      );
    } catch (error) {
      console.error('Error downloading merged PDF:', error);
      toast.error('Downloaden mislukt');
      return statuses.map(s => 
        s.status === 'pending' 
          ? { ...s, status: 'error' as const, error: 'Download failed' } 
          : s
      );
    }
  }, []);

  /**
   * Main batch print function
   */
  const batchPrint = useCallback(async (
    orderIds: string[],
    method: PrintMethod
  ): Promise<BatchPrintStatus[]> => {
    if (orderIds.length === 0) {
      toast.error('Geen orders geselecteerd');
      return [];
    }

    setIsPrinting(true);

    try {
      // Fetch label statuses for all orders
      const statuses = await fetchLabelsForOrders(orderIds);
      
      const labelsAvailable = statuses.filter(s => s.status === 'pending').length;
      const noLabels = statuses.filter(s => s.status === 'no_label').length;

      if (labelsAvailable === 0) {
        toast.error('Geen labels beschikbaar voor geselecteerde orders');
        setIsPrinting(false);
        return statuses;
      }

      if (noLabels > 0) {
        toast.warning(`${noLabels} order(s) zonder label`);
      }

      // Initialize progress
      setProgress({
        current: 0,
        total: labelsAvailable,
        statuses,
      });

      // Execute print based on method
      let results: BatchPrintStatus[];

      switch (method) {
        case 'webusb':
          if (!connectedPrinter) {
            toast.error('Geen printer verbonden');
            setIsPrinting(false);
            return statuses;
          }
          results = await printViaWebUSB(statuses);
          break;

        case 'browser':
          results = await printViaBrowser(statuses);
          break;

        case 'download':
          results = await downloadLabels(statuses);
          break;

        default:
          results = statuses;
      }

      // Final progress update
      setProgress(prev => prev ? { ...prev, current: prev.total, statuses: results } : null);

      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      if (successCount > 0 && errorCount === 0) {
        toast.success(`${successCount} labels verwerkt`);
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(`${successCount} labels verwerkt, ${errorCount} mislukt`);
      } else if (errorCount > 0) {
        toast.error(`${errorCount} labels mislukt`);
      }

      return results;

    } catch (error) {
      console.error('Batch print error:', error);
      toast.error('Batch print mislukt');
      return [];
    } finally {
      setIsPrinting(false);
    }
  }, [connectedPrinter, fetchLabelsForOrders, printViaWebUSB, printViaBrowser, downloadLabels]);

  /**
   * Reset progress state
   */
  const resetProgress = useCallback(() => {
    setProgress(null);
  }, []);

  return {
    batchPrint,
    isPrinting,
    progress,
    resetProgress,
    hasConnectedPrinter: !!connectedPrinter,
    fetchLabelsForOrders,
  };
}
