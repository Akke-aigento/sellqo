import { useRef, useState, useEffect } from 'react';
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

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: POSTransaction | null;
  onPrintComplete?: () => void;
  autoPrint?: boolean;
  openCashDrawer?: boolean;
}

export function ReceiptDialog({ 
  open, 
  onOpenChange, 
  transaction,
  onPrintComplete,
  autoPrint = false,
  openCashDrawer: shouldOpenDrawer = false,
}: ReceiptDialogProps) {
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
        toast.success('Bon wordt afgedrukt');
        onPrintComplete?.();
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handleOpenCashDrawer = async () => {
    const success = await openCashDrawer();
    if (success) {
      toast.success('Kaslade geopend');
    } else {
      toast.error('Kon kaslade niet openen');
    }
  };

  const handleDownload = () => {
    // Create text version of receipt for download
    const lines: string[] = [];
    
    lines.push('='.repeat(40));
    lines.push(currentTenant?.name?.toUpperCase() || 'WINKEL');
    lines.push('='.repeat(40));
    lines.push('');
    lines.push(`Bon: ${transaction.receipt_number || transaction.id.slice(0, 8).toUpperCase()}`);
    lines.push(`Datum: ${new Date(transaction.created_at).toLocaleDateString('nl-NL')}`);
    lines.push(`Tijd: ${new Date(transaction.created_at).toLocaleTimeString('nl-NL')}`);
    lines.push('-'.repeat(40));
    lines.push('');
    
    transaction.items.forEach((item) => {
      lines.push(item.name);
      lines.push(`  ${item.quantity} x €${item.price.toFixed(2)}`.padEnd(32) + `€${(item.quantity * item.price).toFixed(2)}`);
    });
    
    lines.push('');
    lines.push('-'.repeat(40));
    lines.push(`Subtotaal`.padEnd(32) + `€${transaction.subtotal.toFixed(2)}`);
    if (transaction.discount_total > 0) {
      lines.push(`Korting`.padEnd(32) + `-€${transaction.discount_total.toFixed(2)}`);
    }
    lines.push(`BTW (21%)`.padEnd(32) + `€${transaction.tax_total.toFixed(2)}`);
    lines.push('='.repeat(40));
    lines.push(`TOTAAL`.padEnd(32) + `€${transaction.total.toFixed(2)}`);
    lines.push('='.repeat(40));
    lines.push('');
    lines.push('Bedankt voor uw aankoop!');
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bon-${transaction.receipt_number || transaction.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Bon gedownload');
  };

  // Check if this was a cash payment (show cash drawer button)
  const hasCashPayment = transaction.payments.some(p => p.method === 'cash');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kassabon</DialogTitle>
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
              Kopie afdrukken
            </Label>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {hasCashPayment && (
            <Button variant="outline" onClick={handleOpenCashDrawer} className="sm:mr-auto">
              <DollarSign className="mr-2 h-4 w-4" />
              Kaslade
            </Button>
          )}
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button onClick={handlePrint} disabled={isPrinting}>
            <Printer className="mr-2 h-4 w-4" />
            {isPrinting ? 'Printen...' : 'Printen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
