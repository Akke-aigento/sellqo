import { useRef, useState } from 'react';
import { Printer, Download, X, Mail } from 'lucide-react';
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
import { POSReceipt } from './POSReceipt';
import { useTenant } from '@/hooks/useTenant';
import type { POSTransaction } from '@/types/pos';
import { toast } from 'sonner';

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: POSTransaction | null;
  onPrintComplete?: () => void;
}

export function ReceiptDialog({ 
  open, 
  onOpenChange, 
  transaction,
  onPrintComplete,
}: ReceiptDialogProps) {
  const { currentTenant } = useTenant();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!transaction) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    
    try {
      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=320,height=600');
      
      if (!printWindow) {
        toast.error('Pop-up geblokkeerd. Sta pop-ups toe om te printen.');
        return;
      }

      // Get receipt HTML
      const receiptContent = receiptRef.current?.innerHTML || '';

      // Write print-optimized HTML
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Bon - ${transaction.receipt_number || transaction.id.slice(0, 8)}</title>
            <style>
              @page {
                size: 80mm auto;
                margin: 0;
              }
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                margin: 0;
                padding: 8px;
                width: 80mm;
              }
              * {
                box-sizing: border-box;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .text-xs { font-size: 10px; }
              .text-sm { font-size: 12px; }
              .text-base { font-size: 14px; }
              .text-lg { font-size: 16px; }
              .font-bold { font-weight: bold; }
              .font-mono { font-family: 'Courier New', monospace; }
              .uppercase { text-transform: uppercase; }
              .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .flex-1 { flex: 1; }
              .space-y-1 > * + * { margin-top: 4px; }
              .mb-2 { margin-bottom: 8px; }
              .mb-3 { margin-bottom: 12px; }
              .mb-4 { margin-bottom: 16px; }
              .mt-1 { margin-top: 4px; }
              .mt-4 { margin-top: 16px; }
              .my-1 { margin-top: 4px; margin-bottom: 4px; }
              .my-2 { margin-top: 8px; margin-bottom: 8px; }
              .pl-2 { padding-left: 8px; }
              .p-4 { padding: 16px; }
              .border-t { border-top: 1px solid black; }
              .border-dashed { border-style: dashed; }
              .whitespace-pre-line { white-space: pre-line; }
              .tracking-widest { letter-spacing: 0.1em; }
              .inline-block { display: inline-block; }
            </style>
          </head>
          <body>
            ${receiptContent}
          </body>
        </html>
      `);

      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
        toast.success('Bon wordt afgedrukt');
        onPrintComplete?.();
      };
    } catch (error) {
      toast.error('Fout bij printen');
    } finally {
      setIsPrinting(false);
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

        <DialogFooter className="flex-col sm:flex-row gap-2">
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
