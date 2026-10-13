import { useRef, useState, useEffect } from 'react';
import { receiptVatLines, vatLabelT } from '@/lib/calculations/posTotals';
import { Printer, Download, X, Mail, Copy, DollarSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { POSReceipt } from './POSReceipt';
import { useTenant } from '@/hooks/useTenant';
import { usePOSPrinter } from '@/hooks/usePOSPrinter';
import type { POSTransaction } from '@/types/pos';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: POSTransaction | null;
  onPrintComplete?: () => void;
  autoPrint?: boolean;
  openCashDrawer?: boolean;
  /** APP-CLEAN-3b: "Voettekst bon" uit de kassa-instellingen; werd opgeslagen maar nooit getoond. */
  footerText?: string;
}

export function ReceiptDialog({ 
  open, 
  onOpenChange, 
  transaction,
  onPrintComplete,
  autoPrint = false,
  openCashDrawer: shouldOpenDrawer = false,
  footerText,
}: ReceiptDialogProps) {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printCopy, setPrintCopy] = useState(false);
  const { printReceipt, openCashDrawer } = usePOSPrinter();
  const hasAutoPrinted = useRef(false);

  // Auto-print on open if enabled
  useEffect(() => {
    if (open && autoPrint && transaction && receiptRef.current && !hasAutoPrinted.current) {
      hasAutoPrinted.current = true;
      // Small delay to ensure content is rendered
      setTimeout(() => {
        handlePrint();
      }, 300);
    }
    
    if (!open) {
      hasAutoPrinted.current = false;
    }
  }, [open, autoPrint, transaction]);

  // Open cash drawer if requested (for cash payments)
  useEffect(() => {
    if (open && shouldOpenDrawer && transaction) {
      openCashDrawer();
    }
  }, [open, shouldOpenDrawer, transaction, openCashDrawer]);

  if (!transaction) return null;

  const handlePrint = async () => {
    if (!receiptRef.current) return;
    
    setIsPrinting(true);
    
    try {
      const success = await printReceipt(receiptRef.current, {
        copies: printCopy ? 2 : 1,
        paperWidth: '80mm',
      });

      if (success) {
        toast.success(t('admin.pos.msg.printing'));
        onPrintComplete?.();
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handleOpenCashDrawer = async () => {
    // APP-CLEAN-3b: openCashDrawer stuurt een printopdracht (de meeste bonprinters
    // openen de lade bij een print). Of de lade echt opengaat, weet de browser niet;
    // "Kaslade geopend" beloofde meer dan we kunnen zien.
    const success = await openCashDrawer();
    if (success) {
      toast.success(t('admin.pos.msg.drawer_sent'));
    } else {
      toast.error(t('admin.pos.msg.printer_failed'));
    }
  };

  const handleDownload = () => {
    // Create text version of receipt for download
    const lines: string[] = [];
    
    lines.push('='.repeat(40));
    lines.push((currentTenant?.name || t('admin.pos.receipt.store')).toUpperCase());
    lines.push('='.repeat(40));
    lines.push('');
    lines.push(`${t('admin.pos.receipt.receipt')} ${transaction.receipt_number || transaction.id.slice(0, 8).toUpperCase()}`);
    lines.push(`${t('admin.pos.receipt.date')} ${new Date(transaction.created_at).toLocaleDateString(i18n.language)}`);
    lines.push(`${t('admin.pos.receipt.time')} ${new Date(transaction.created_at).toLocaleTimeString(i18n.language)}`);
    lines.push('-'.repeat(40));
    lines.push('');
    
    transaction.items.forEach((item) => {
      lines.push(item.name);
      if (item.addons?.length) lines.push(`  + ${item.addons.map((x) => x.name).join(', + ')}`);
      lines.push(`  ${item.quantity} x €${item.price.toFixed(2)}`.padEnd(32) + `€${(item.quantity * item.price).toFixed(2)}`);
    });
    
    lines.push('');
    lines.push('-'.repeat(40));
    lines.push(t('admin.pos.receipt.subtotal').padEnd(32) + `€${transaction.subtotal.toFixed(2)}`);
    if (transaction.discount_total > 0) {
      lines.push(t('admin.pos.receipt.discount').padEnd(32) + `-€${transaction.discount_total.toFixed(2)}`);
    }
    // APP-CLEAN-3c: btw per tarief i.p.v. altijd "BTW (21%)".
    const vatLines = receiptVatLines(transaction, currentTenant?.default_vat_handling);
    if (vatLines && vatLines.length > 0) {
      for (const line of vatLines) lines.push(t('admin.pos.receipt.vat_over', { vat: vatLabelT(line.rate, t), base: `€${line.base.toFixed(2)}` }).padEnd(32) + `€${line.tax.toFixed(2)}`);
    } else {
      lines.push(t('admin.pos.receipt.vat').padEnd(32) + `€${transaction.tax_total.toFixed(2)}`);
    }
    lines.push('='.repeat(40));
    lines.push(t('admin.pos.receipt.total').padEnd(32) + `€${transaction.total.toFixed(2)}`);
    lines.push('='.repeat(40));
    lines.push('');
    lines.push(t('admin.pos.receipt.thanks'));
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t('admin.pos.msg.receipt_file')}-${transaction.receipt_number || transaction.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(t('admin.pos.msg.receipt_downloaded'));
  };

  // Check if this was a cash payment (show cash drawer button)
  const hasCashPayment = transaction.payments.some(p => p.method === 'cash');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('admin.pos.receiptDialog.kassabon')}</DialogTitle>
          <DialogDescription>
            Bon #{transaction.receipt_number || transaction.id.slice(0, 8).toUpperCase()}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="flex justify-center bg-muted p-4 rounded-lg">
            <POSReceipt
              ref={receiptRef}
              transaction={transaction}
              storeName={currentTenant?.name}
              footerText={footerText || undefined}
              vatHandling={currentTenant?.default_vat_handling}
            />
          </div>
        </ScrollArea>

        {/* Print options */}
        <div className="flex items-center gap-4 py-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="printCopy" 
              checked={printCopy} 
              onCheckedChange={(checked) => setPrintCopy(checked === true)} 
            />
            <Label htmlFor="printCopy" className="text-sm cursor-pointer">
              <Copy className="inline h-3 w-3 mr-1" />
              {t('admin.pos.receiptDialog.kopie_afdrukken')}
            </Label>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {hasCashPayment && (
            <Button variant="outline" onClick={handleOpenCashDrawer} className="sm:mr-auto">
              <DollarSign className="mr-2 h-4 w-4" />
              {t('admin.pos.receiptDialog.kaslade')}
            </Button>
          )}
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            {t('admin.seo.sEOHealthChecklist.download')}
          </Button>
          <Button onClick={handlePrint} disabled={isPrinting}>
            <Printer className="mr-2 h-4 w-4" />
            {isPrinting ? t('admin.pos.receiptDialog.printen') : t('admin.pos.receiptDialog.printen_2')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
