import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

export interface PrintOptions {
  copies?: number;
  silentPrint?: boolean;
  paperWidth?: '58mm' | '80mm';
}

export interface UsePOSPrinterReturn {
  printReceipt: (element: HTMLElement, options?: PrintOptions) => Promise<boolean>;
  openCashDrawer: () => Promise<boolean>;
  isPrinting: boolean;
}

export function usePOSPrinter(): UsePOSPrinterReturn {
  const isPrintingRef = useRef(false);

  // Print receipt using Web Print API
  const printReceipt = useCallback(async (
    element: HTMLElement,
    options: PrintOptions = {}
  ): Promise<boolean> => {
    const { copies = 1, paperWidth = '80mm' } = options;

    if (isPrintingRef.current) {
      toast.error('Printer is bezet');
      return false;
    }

    isPrintingRef.current = true;

    try {
      // Create a hidden iframe for printing
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'absolute';
      printFrame.style.top = '-10000px';
      printFrame.style.left = '-10000px';
      printFrame.style.width = paperWidth;
      document.body.appendChild(printFrame);

      const printDocument = printFrame.contentDocument || printFrame.contentWindow?.document;
      if (!printDocument) {
        throw new Error('Could not access print frame document');
      }

      // Write the receipt content with print-optimized styles
      printDocument.open();
      printDocument.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Bon</title>
            <style>
              @page {
                size: ${paperWidth} auto;
                margin: 0;
              }
              
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              
              html, body {
                width: ${paperWidth};
                font-family: 'Courier New', Courier, monospace;
                font-size: 12px;
                line-height: 1.3;
                color: #000;
                background: #fff;
              }
              
              .receipt {
                width: 100%;
                padding: 8px;
              }
              
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .text-xs { font-size: 10px; }
              .text-sm { font-size: 11px; }
              .text-base { font-size: 12px; }
              .text-lg { font-size: 14px; }
              .font-bold { font-weight: bold; }
              .font-mono { font-family: 'Courier New', Courier, monospace; }
              .uppercase { text-transform: uppercase; }
              
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .items-center { align-items: center; }
              .flex-1 { flex: 1; }
              
              .mb-1 { margin-bottom: 2px; }
              .mb-2 { margin-bottom: 4px; }
              .mb-3 { margin-bottom: 8px; }
              .mb-4 { margin-bottom: 12px; }
              .mt-1 { margin-top: 2px; }
              .mt-4 { margin-top: 12px; }
              .my-1 { margin-top: 2px; margin-bottom: 2px; }
              .my-2 { margin-top: 4px; margin-bottom: 4px; }
              .pl-2 { padding-left: 8px; }
              .p-4 { padding: 12px; }
              
              .space-y-1 > * + * { margin-top: 2px; }
              
              .border-t { border-top: 1px solid #000; }
              .border-dashed { border-style: dashed; }
              .border-black { border-color: #000; }
              
              .truncate {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
              
              .whitespace-pre-line { white-space: pre-line; }
              .tracking-widest { letter-spacing: 0.1em; }
              .inline-block { display: inline-block; }
              
              /* Receipt-specific styles */
              .receipt-divider {
                border-top: 1px dashed #000;
                margin: 6px 0;
              }
              
              .receipt-total-line {
                border-top: 1px solid #000;
                margin: 4px 0;
              }
              
              .receipt-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 2px;
              }
              
              .receipt-item-name {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                padding-right: 8px;
              }
              
              @media print {
                html, body {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
            </style>
          </head>
          <body>
            <div class="receipt">
              ${element.innerHTML}
            </div>
          </body>
        </html>
      `);
      printDocument.close();

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 100));

      // Print the specified number of copies
      for (let i = 0; i < copies; i++) {
        printFrame.contentWindow?.print();
        
        // Small delay between copies
        if (i < copies - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Clean up
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 1000);

      return true;
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Printen mislukt');
      return false;
    } finally {
      isPrintingRef.current = false;
    }
  }, []);

  // Open cash drawer (via ESC/POS command if supported)
  const openCashDrawer = useCallback(async (): Promise<boolean> => {
    // Cash drawer opening typically requires direct hardware access
    // or a receipt printer with ESC/POS support
    // For web-based POS, this is usually handled by the print driver
    // or a dedicated hardware API
    
    try {
      // Attempt to trigger cash drawer via a print command
      // Most thermal printers with cash drawer support will open
      // the drawer when receiving specific ESC/POS commands
      
      const drawerFrame = document.createElement('iframe');
      drawerFrame.style.position = 'absolute';
      drawerFrame.style.top = '-10000px';
      drawerFrame.style.left = '-10000px';
      document.body.appendChild(drawerFrame);

      const drawerDoc = drawerFrame.contentDocument || drawerFrame.contentWindow?.document;
      if (!drawerDoc) {
        throw new Error('Could not create drawer frame');
      }

      // ESC/POS cash drawer command embedded in print content
      // Note: This may not work with all printers
      drawerDoc.open();
      drawerDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              @page { size: 80mm 1mm; margin: 0; }
              body { 
                font-size: 1px; 
                color: transparent;
                /* ESC p m t1 t2 - Pulse command for cash drawer */
              }
            </style>
          </head>
          <body>
            <!-- Cash drawer pulse command placeholder -->
            <span style="font-family: monospace;">&#27;p&#0;&#25;&#250;</span>
          </body>
        </html>
      `);
      drawerDoc.close();

      await new Promise(resolve => setTimeout(resolve, 50));
      drawerFrame.contentWindow?.print();

      setTimeout(() => {
        document.body.removeChild(drawerFrame);
      }, 500);

      return true;
    } catch (error) {
      console.error('Cash drawer error:', error);
      return false;
    }
  }, []);

  return {
    printReceipt,
    openCashDrawer,
    isPrinting: isPrintingRef.current,
  };
}
